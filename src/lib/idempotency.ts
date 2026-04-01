/**
 * Exactly-once recording for payment-derived side effects.
 *
 * Uses Redis SET NX to ensure leaderboard + activity writes
 * happen at most once per payment hash (or per order for packs),
 * regardless of which serverless instance handles the request.
 *
 * Redis keys:
 *   recorded:{paymentHash}   — fortune reveal recorded (24h TTL)
 *   recorded:sats:{orderId}  — pack sats spent recorded (90d TTL)
 */

import { getRedis } from "@/lib/redis";
import { recordFortuneReveal, recordSatsSpent } from "@/lib/leaderboard";
import { recordActivity } from "@/lib/activity";
import type { Rarity } from "@/lib/fortunes";

const FORTUNE_RECORDED_TTL = 86_400; // 24 hours (matches payment TTL)
const SATS_RECORDED_TTL = 90 * 24 * 60 * 60; // 90 days (matches order TTL)

/**
 * Record a fortune reveal to leaderboard + activity ONCE per paymentHash.
 * Returns true if this call was the first to record (won the SET NX race).
 *
 * Safe to call from /fortune, /fortune/status, and /fortune/claim —
 * only the first call across all instances will write.
 */
export async function recordFortuneOnce(
  paymentHash: string,
  deviceId: string,
  displayName: string,
  rarity: Rarity,
  sats: number,
): Promise<boolean> {
  const redis = getRedis();

  if (!redis) {
    // No Redis — record unconditionally (dev-only; accepts dupe risk)
    await Promise.all([
      recordFortuneReveal(deviceId, displayName, rarity, sats),
      recordActivity(displayName, rarity),
    ]);
    return true;
  }

  try {
    const acquired = await redis.set(`recorded:${paymentHash}`, Date.now(), {
      nx: true,
      ex: FORTUNE_RECORDED_TTL,
    });

    if (!acquired) return false; // Another instance/request already recorded

    await Promise.all([
      recordFortuneReveal(deviceId, displayName, rarity, sats),
      recordActivity(displayName, rarity),
    ]);
    return true;
  } catch (e) {
    console.error("[idempotency:recordFortuneOnce]", e);
    return false;
  }
}

/**
 * Record sats spent ONCE per pack order.
 * Called at pack payment verification time (txid confirmed).
 * Returns true if this call was the first to record.
 */
export async function recordSatsOnce(
  orderId: string,
  deviceId: string,
  displayName: string,
  sats: number,
): Promise<boolean> {
  const redis = getRedis();

  if (!redis) {
    await recordSatsSpent(deviceId, displayName, sats);
    return true;
  }

  try {
    const acquired = await redis.set(`recorded:sats:${orderId}`, Date.now(), {
      nx: true,
      ex: SATS_RECORDED_TTL,
    });

    if (!acquired) return false;

    await recordSatsSpent(deviceId, displayName, sats);
    return true;
  } catch (e) {
    console.error("[idempotency:recordSatsOnce]", e);
    return false;
  }
}
