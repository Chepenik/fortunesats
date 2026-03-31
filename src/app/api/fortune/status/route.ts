import { isPaid } from "@/lib/payment-store";
import { getRedis } from "@/lib/redis";
import { getRandomFortune, type Rarity } from "@/lib/fortunes";
import { checkRateLimit } from "@/lib/ratelimit";
import { getOrCreateDeviceId, attachDeviceCookie } from "@/lib/device-id";
import { recordFortuneReveal } from "@/lib/leaderboard";

const FORTUNE_TTL = 86_400; // 24 hours

/**
 * In-memory fortune cache (fast path). Redis is authoritative.
 */
const localFortuneCache = new Map<string, { fortune: string; rarity: Rarity; timestamp: string }>();

/** Track which payment hashes we've already recorded to the leaderboard (avoid double-counting) */
const recordedHashes = new Set<string>();

export async function GET(req: Request) {
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
  } catch {
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
            localFortuneCache.set(paymentHash, cached);
          }
        } catch {
          // Fortune cache read failed — safe to generate a new one since payment is verified
        }
      }
    }

    if (!cached) {
      const fortune = getRandomFortune();
      cached = { fortune: fortune.text, rarity: fortune.rarity, timestamp: new Date().toISOString() };
      localFortuneCache.set(paymentHash, cached);
      try {
        const redis = getRedis();
        if (redis) {
          await redis.set(`fortune:${paymentHash}`, cached, { ex: FORTUNE_TTL });
        }
      } catch {
        // Fortune cache write failed — fortune is already in local cache, acceptable
      }
    }

    // Record to leaderboard once per payment hash (avoid double-counting on re-checks)
    const { deviceId, isNew } = getOrCreateDeviceId(req);
    if (!recordedHashes.has(paymentHash)) {
      recordedHashes.add(paymentHash);
      await recordFortuneReveal(deviceId, cached.rarity, 100);
    }

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
