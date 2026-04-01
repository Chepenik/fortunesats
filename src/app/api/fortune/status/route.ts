import { isPaid } from "@/lib/payment-store";
import { getRedis } from "@/lib/redis";
import { getRandomFortune, type Rarity } from "@/lib/fortunes";
import { checkRateLimit } from "@/lib/ratelimit";
import { getOrCreateDeviceId, attachDeviceCookie, resolveDisplayNameFromReq } from "@/lib/device-id";
import { recordFortuneOnce } from "@/lib/idempotency";
import { getFlags, unavailableResponse } from "@/lib/flags";

const FORTUNE_TTL = 86_400; // 24 hours

/**
 * In-memory fortune cache (fast path). Redis is authoritative.
 * Capped to prevent unbounded growth on warm Fluid Compute instances.
 */
const MAX_FORTUNE_CACHE = 500;
const localFortuneCache = new Map<string, { fortune: string; rarity: Rarity; timestamp: string }>();

export async function GET(req: Request) {
  const { fortuneSingleEnabled } = getFlags();
  if (!fortuneSingleEnabled) return unavailableResponse("Fortunes");

  const limited = await checkRateLimit(req, { prefix: "fortune-status", limit: 10, window: "1 m" });
  if (limited) return limited;

  const url = new URL(req.url);
  const paymentHash = url.searchParams.get("paymentHash");

  if (!paymentHash || paymentHash.length > 256) {
    return Response.json(
      { error: { code: "invalid_param", message: "paymentHash is required" } },
      { status: 400 },
    );
  }

  let paid: boolean;
  try {
    paid = await isPaid(paymentHash);
  } catch (e) {
    console.error("[fortune/status:isPaid]", e);
    return Response.json(
      { error: { code: "service_unavailable", message: "Payment verification temporarily unavailable. Please retry." } },
      { status: 503 },
    );
  }

  if (paid) {
    // Check local cache first, then Redis, then generate
    let cached = localFortuneCache.get(paymentHash);

    if (!cached) {
      const redis = getRedis();
      if (redis) {
        try {
          const stored = await redis.get<{ fortune: string; rarity?: Rarity; timestamp: string }>(
            `fortune:${paymentHash}`,
          );
          if (stored) {
            cached = {
              fortune: stored.fortune,
              rarity: stored.rarity ?? "common",
              timestamp: stored.timestamp,
            };
            if (localFortuneCache.size >= MAX_FORTUNE_CACHE) localFortuneCache.clear();
            localFortuneCache.set(paymentHash, cached);
          }
        } catch (e) {
          console.error("[fortune/status:cacheRead]", e);
          // Safe to generate a new one since payment is verified
        }
      }
    }

    if (!cached) {
      const fortune = getRandomFortune();
      cached = { fortune: fortune.text, rarity: fortune.rarity, timestamp: new Date().toISOString() };
      if (localFortuneCache.size >= MAX_FORTUNE_CACHE) localFortuneCache.clear();
      localFortuneCache.set(paymentHash, cached);
      try {
        const redis = getRedis();
        if (redis) {
          await redis.set(`fortune:${paymentHash}`, cached, { ex: FORTUNE_TTL });
        }
      } catch (e) {
        console.error("[fortune/status:cacheWrite]", e);
        // Fortune is already in local cache, acceptable
      }
    }

    // Record to leaderboard + activity once per payment hash (Redis SET NX — cross-instance safe)
    const { deviceId, isNew } = getOrCreateDeviceId(req);
    const displayName = resolveDisplayNameFromReq(req, deviceId);
    await recordFortuneOnce(paymentHash, deviceId, displayName, cached.rarity, 100);

    const res = Response.json({
      paid: true,
      paymentHash,
      fortune: cached.fortune,
      rarity: cached.rarity,
      timestamp: cached.timestamp,
    });
    if (isNew) attachDeviceCookie(res, deviceId);
    return res;
  }

  return Response.json({ paid: false, paymentHash });
}
