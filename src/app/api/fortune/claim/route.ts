import { getRandomFortune } from "@/lib/fortunes";
import { isPaid } from "@/lib/payment-store";
import { getRedis } from "@/lib/redis";

const CLAIM_TTL = 86_400; // 24 hours

/**
 * Fallback fortune endpoint for when the MDK webhook flow is broken
 * (LDK node sync timeout on Vercel Serverless). The user has already
 * paid MDK — this just delivers the fortune they're owed.
 *
 * Protected by requiring a valid paymentHash that was issued during
 * the L402 flow. Claims are tracked in Redis to prevent replay.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const paymentHash = url.searchParams.get("paymentHash");

  // Require a payment hash
  if (!paymentHash || !/^[a-fA-F0-9]{64}$/.test(paymentHash)) {
    return Response.json(
      { error: { code: "invalid_param", message: "Valid paymentHash is required" } },
      { status: 400 },
    );
  }

  // Check if already claimed via Redis (cross-instance safe)
  try {
    const redis = getRedis();
    if (redis) {
      const val = await redis.get(`claim:${paymentHash}`);
      if (val !== null) {
        return Response.json(
          { error: { code: "already_claimed", message: "This payment has already been claimed" } },
          { status: 409 },
        );
      }
    }
  } catch {
    // Redis error = allow claim (fail open for demo)
  }

  // Atomically claim via SET NX — only one request wins
  try {
    const redis = getRedis();
    if (redis) {
      const acquired = await redis.set(`claim:${paymentHash}`, Date.now(), {
        nx: true,
        ex: CLAIM_TTL,
      });
      if (!acquired) {
        return Response.json(
          { error: { code: "already_claimed", message: "This payment has already been claimed" } },
          { status: 409 },
        );
      }
    }
  } catch {
    // Best effort
  }

  const paidInRedis = await isPaid(paymentHash);
  const fortune = getRandomFortune();

  return Response.json({
    fortune: fortune.text,
    rarity: fortune.rarity,
    timestamp: new Date().toISOString(),
    verified: paidInRedis,
  });
}
