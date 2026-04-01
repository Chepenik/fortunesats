/**
 * Payment state backed by Redis (cross-instance) with in-memory fast path.
 *
 * MDK writes to globalThis[Symbol.for("mdk-checkout:payment-state")]
 * on the instance that handles the webhook. We mirror that to Redis
 * so every Vercel instance can see it.
 */

import { getRedis } from "@/lib/redis";

const MDK_PAYMENT_STATE_KEY = Symbol.for("mdk-checkout:payment-state");
const PAYMENT_TTL = 86_400; // 24 hours

interface MdkPaymentState {
  receivedPaymentHashes: Set<string>;
}

/* ─── In-memory caches (fast path, not authoritative) ───── */
// Capped to prevent unbounded growth on warm Fluid Compute instances.
// Redis is authoritative; clearing local cache just means an extra Redis lookup.
const MAX_LOCAL_CACHE = 1000;

const localPaidCache = new Set<string>();
const localConsumedCache = new Set<string>();

function addCapped(cache: Set<string>, value: string) {
  if (cache.size >= MAX_LOCAL_CACHE) cache.clear();
  cache.add(value);
}

/* ─── Helpers ────────────────────────────────────────────── */

function isLocallyPaid(paymentHash: string): boolean {
  // Check MDK's globalThis state (only populated on the webhook instance)
  const state = (globalThis as Record<symbol, MdkPaymentState | undefined>)[
    MDK_PAYMENT_STATE_KEY
  ];
  if (state?.receivedPaymentHashes.has(paymentHash)) return true;
  // Check our local mirror
  return localPaidCache.has(paymentHash);
}

/* ─── Public API ─────────────────────────────────────────── */

/**
 * Write payment-settled state to Redis. Called from the MDK
 * webhook wrapper after MDK processes the payment.
 */
export async function markPaidInRedis(paymentHash: string): Promise<void> {
  addCapped(localPaidCache, paymentHash);
  try {
    const redis = getRedis();
    if (redis) {
      // NX: idempotent — only writes if key doesn't exist.
      // Prevents redundant Redis writes on duplicate webhooks.
      await redis.set(`paid:${paymentHash}`, Date.now(), { nx: true, ex: PAYMENT_TTL });
    }
  } catch (e) {
    console.error("[payment-store:markPaidInRedis]", e);
    // In-memory still works on this instance
  }
}

/**
 * Check if a payment hash has been settled.
 * Fast path: in-memory (globalThis + local cache).
 * Authoritative: Redis paid:{hash} key.
 *
 * Throws if Redis is unreachable and the hash isn't in local cache,
 * so callers can decide how to handle the outage.
 */
export async function isPaid(paymentHash: string): Promise<boolean> {
  if (isLocallyPaid(paymentHash)) return true;
  const redis = getRedis();
  if (!redis) {
    // No Redis configured — can only check local state
    return false;
  }
  const val = await redis.get(`paid:${paymentHash}`);
  if (val !== null) {
    addCapped(localPaidCache, paymentHash); // warm local cache
    return true;
  }
  return false;
}

/**
 * Atomically consume a payment hash (replay protection).
 * Uses Redis SET NX so only one instance/request wins.
 *
 * Throws if Redis is unreachable — callers must handle the outage
 * rather than silently allowing replay.
 */
export async function consumePayment(paymentHash: string): Promise<boolean> {
  if (!(await isPaid(paymentHash))) return false;
  if (localConsumedCache.has(paymentHash)) return false;

  const redis = getRedis();
  if (redis) {
    const acquired = await redis.set(`consumed:${paymentHash}`, Date.now(), {
      nx: true,
      ex: PAYMENT_TTL,
    });
    if (!acquired) return false; // another instance already consumed it
  }

  addCapped(localConsumedCache, paymentHash);
  return true;
}
