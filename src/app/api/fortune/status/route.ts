import { isPaid } from "@/lib/payment-store";
import { getRedis } from "@/lib/redis";
import { getRandomFortune } from "@/lib/fortunes";

const FORTUNE_TTL = 86_400; // 24 hours

/**
 * In-memory fortune cache (fast path). Redis is authoritative.
 */
const localFortuneCache = new Map<string, { fortune: string; timestamp: string }>();

export async function GET(req: Request) {
  const url = new URL(req.url);
  const paymentHash = url.searchParams.get("paymentHash");

  if (!paymentHash || paymentHash.length > 256) {
    return Response.json(
      { error: { code: "invalid_param", message: "paymentHash is required" } },
      { status: 400 },
    );
  }

  const paid = await isPaid(paymentHash);

  if (paid) {
    // Check local cache first, then Redis, then generate
    let cached = localFortuneCache.get(paymentHash);

    if (!cached) {
      // Try Redis
      try {
        const redis = getRedis();
        if (redis) {
          const stored = await redis.get<{ fortune: string; timestamp: string }>(
            `fortune:${paymentHash}`,
          );
          if (stored) {
            cached = stored;
            localFortuneCache.set(paymentHash, cached);
          }
        }
      } catch {
        // Redis read failed — fall through to generate
      }
    }

    if (!cached) {
      // Generate and persist to both caches
      cached = { fortune: getRandomFortune(), timestamp: new Date().toISOString() };
      localFortuneCache.set(paymentHash, cached);
      try {
        const redis = getRedis();
        if (redis) {
          await redis.set(`fortune:${paymentHash}`, cached, { ex: FORTUNE_TTL });
        }
      } catch {
        // Best effort
      }
    }

    return Response.json({
      paid: true,
      paymentHash,
      fortune: cached.fortune,
      timestamp: cached.timestamp,
    });
  }

  return Response.json({ paid: false, paymentHash });
}
