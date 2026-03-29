import { isPaid } from "@/lib/payment-store";
import { getRedis } from "@/lib/redis";
import { getRandomFortune, type Rarity } from "@/lib/fortunes";
import { checkRateLimit } from "@/lib/ratelimit";

const FORTUNE_TTL = 86_400; // 24 hours

/**
 * In-memory fortune cache (fast path). Redis is authoritative.
 */
const localFortuneCache = new Map<string, { fortune: string; rarity: Rarity; timestamp: string }>();

export async function GET(req: Request) {
  const limited = await checkRateLimit(req, { prefix: "fortune-status", limit: 20, window: "1 m" });
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

    return Response.json({
      paid: true,
      paymentHash,
      fortune: cached.fortune,
      rarity: cached.rarity,
      timestamp: cached.timestamp,
    });
  }

  return Response.json({ paid: false, paymentHash });
}
