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

const localPaidCache = new Set<string>();
const localConsumedCache = new Set<string>();

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
  localPaidCache.add(paymentHash);
  try {
    const redis = getRedis();
    if (redis) {
      await redis.set(`paid:${paymentHash}`, Date.now(), { ex: PAYMENT_TTL });
    }
  } catch {
    // Best effort — in-memory still works on this instance
  }
}

/**
 * Check if a payment hash has been settled.
 * Fast path: in-memory (globalThis + local cache).
 * Authoritative: Redis paid:{hash} key.
 */
export async function isPaid(paymentHash: string): Promise<boolean> {
  if (isLocallyPaid(paymentHash)) return true;
  try {
    const redis = getRedis();
    if (redis) {
      const val = await redis.get(`paid:${paymentHash}`);
      if (val !== null) {
        localPaidCache.add(paymentHash); // warm local cache
        return true;
      }
    }
  } catch {
    // Redis unavailable — fall back to in-memory only
  }
  return false;
}

/**
 * Atomically consume a payment hash (replay protection).
 * Uses Redis SET NX so only one instance/request wins.
 */
export async function consumePayment(paymentHash: string): Promise<boolean> {
  if (!(await isPaid(paymentHash))) return false;
  if (localConsumedCache.has(paymentHash)) return false;

  try {
    const redis = getRedis();
    if (redis) {
      // SET NX returns true only if the key didn't exist → first consumer wins
      const acquired = await redis.set(`consumed:${paymentHash}`, Date.now(), {
        nx: true,
        ex: PAYMENT_TTL,
      });
      if (!acquired) return false; // another instance already consumed it
    }
  } catch {
    // Redis down — allow it (fail open for demo)
  }

  localConsumedCache.add(paymentHash);
  return true;
}
