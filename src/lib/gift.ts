/**
 * Gift fortune model — Redis-backed.
 *
 * Redis keys:
 *   gift:{token}              — hash with gift state
 *   gift:checkout:{checkoutId} — idempotency guard (ensures one gift per checkout)
 *
 * Gift lifecycle: paid → claimed | expired
 * Expiry is handled via Redis TTL (30 days).
 */

import { getRedis } from "@/lib/redis";
import { getRandomFortune, type Rarity } from "@/lib/fortunes";

/* ─── Types ──────────────────────────────────────────────── */

export type GiftStatus = "paid" | "claimed" | "expired";

export interface Gift {
  token: string;
  fortune: string;
  rarity: Rarity;
  status: GiftStatus;
  senderDeviceId: string;
  claimerDeviceId?: string;
  checkoutId: string;
  createdAt: string;
  claimedAt?: string;
  expiresAt: string;
}

/* ─── Constants ──────────────────────────────────────────── */

const GIFT_TTL = 30 * 24 * 60 * 60; // 30 days
const GIFT_EXPIRY_MS = GIFT_TTL * 1000;

/* ─── Create ─────────────────────────────────────────────── */

/**
 * Create a gift fortune after verified payment.
 * Idempotent per checkoutId — returns existing gift on replay.
 */
export async function createGift(
  checkoutId: string,
  senderDeviceId: string,
): Promise<Gift | null> {
  const redis = getRedis();
  if (!redis) return null;

  // Idempotency: one gift per checkout
  const idempotencyKey = `gift:checkout:${checkoutId}`;
  const existingToken = await redis.get<string>(idempotencyKey);
  if (existingToken) {
    return getGift(existingToken);
  }

  // Use Web Crypto API for edge-runtime compatibility
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  const token = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  const now = new Date();
  const f = getRandomFortune();

  const gift: Gift = {
    token,
    fortune: f.text,
    rarity: f.rarity,
    status: "paid",
    senderDeviceId,
    checkoutId,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + GIFT_EXPIRY_MS).toISOString(),
  };

  // Race-safe: SET NX the idempotency key first
  const acquired = await redis.set(idempotencyKey, token, {
    nx: true,
    ex: GIFT_TTL,
  });

  if (!acquired) {
    // Another instance won — return their gift
    const raceToken = await redis.get<string>(idempotencyKey);
    return raceToken ? getGift(raceToken) : null;
  }

  await redis.set(`gift:${token}`, gift, { ex: GIFT_TTL });
  return gift;
}

/* ─── Read ───────────────────────────────────────────────── */

/** Fetch a gift by token. Returns null if not found or expired. */
export async function getGift(token: string): Promise<Gift | null> {
  const redis = getRedis();
  if (!redis) return null;

  const gift = await redis.get<Gift>(`gift:${token}`);
  if (!gift) return null;

  // Check logical expiry (Redis TTL is the hard boundary)
  if (gift.status === "paid" && new Date(gift.expiresAt) < new Date()) {
    return { ...gift, status: "expired" };
  }

  return gift;
}

/* ─── Claim ──────────────────────────────────────────────── */

/**
 * Atomically claim a gift. Returns the gift with fortune on success.
 * Uses SET NX on a claim lock to ensure single-claim.
 */
export async function claimGift(
  token: string,
  claimerDeviceId: string,
): Promise<
  | { success: true; gift: Gift }
  | { success: false; error: string; status?: number }
> {
  const redis = getRedis();
  if (!redis) {
    return { success: false, error: "Service unavailable", status: 503 };
  }

  const gift = await redis.get<Gift>(`gift:${token}`);
  if (!gift) {
    return { success: false, error: "Gift not found or expired", status: 404 };
  }

  if (gift.status === "claimed") {
    return { success: false, error: "This gift has already been claimed", status: 409 };
  }

  if (new Date(gift.expiresAt) < new Date()) {
    return { success: false, error: "This gift has expired", status: 410 };
  }

  // Atomic claim lock — only one request wins
  const claimKey = `gift:claimed:${token}`;
  const acquired = await redis.set(claimKey, Date.now(), {
    nx: true,
    ex: GIFT_TTL,
  });

  if (!acquired) {
    return { success: false, error: "This gift has already been claimed", status: 409 };
  }

  // Update gift state
  const claimed: Gift = {
    ...gift,
    status: "claimed",
    claimerDeviceId,
    claimedAt: new Date().toISOString(),
  };

  await redis.set(`gift:${token}`, claimed, { ex: GIFT_TTL });

  return { success: true, gift: claimed };
}
