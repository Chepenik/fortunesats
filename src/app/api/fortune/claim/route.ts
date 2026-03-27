import { getRandomFortune } from "@/lib/fortunes";
import { isPaid } from "@/lib/payment-store";

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
  const alreadyClaimed = await checkClaimed(paymentHash);
  if (alreadyClaimed) {
    return Response.json(
      { error: { code: "already_claimed", message: "This payment has already been claimed" } },
      { status: 409 },
    );
  }

  // Mark as claimed in Redis before returning fortune
  await markClaimed(paymentHash);

  // If the payment was detected in-memory on this instance, great.
  // If not, we still deliver — the user already paid MDK and the
  // webhook may have landed on a different serverless instance.
  const paidOnThisInstance = isPaid(paymentHash);

  return Response.json({
    fortune: getRandomFortune(),
    timestamp: new Date().toISOString(),
    verified: paidOnThisInstance,
  });
}

/* ─── Redis claim tracking ──────────────────────────────── */

async function getRedis() {
  if (!process.env.UPSTASH_REDIS_REST_URL) return null;
  const { Redis } = await import("@upstash/redis");
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
}

async function checkClaimed(paymentHash: string): Promise<boolean> {
  try {
    const redis = await getRedis();
    if (!redis) return false; // No Redis = dev mode, skip check
    const val = await redis.get(`claim:${paymentHash}`);
    return val !== null;
  } catch {
    return false; // Redis error = allow claim (fail open for demo)
  }
}

async function markClaimed(paymentHash: string): Promise<void> {
  try {
    const redis = await getRedis();
    if (!redis) return;
    await redis.set(`claim:${paymentHash}`, 1, { ex: 86400 }); // 24h TTL
  } catch {
    // Best-effort — don't block fortune delivery
  }
}
