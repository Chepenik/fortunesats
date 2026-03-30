import { getRandomFortune } from "@/lib/fortunes";
import { isPaid } from "@/lib/payment-store";
import { getRedis } from "@/lib/redis";
import { checkRateLimit } from "@/lib/ratelimit";
import { getOrCreateDeviceId, attachDeviceCookie } from "@/lib/device-id";
import { recordFortuneReveal } from "@/lib/leaderboard";
import { recordActivity } from "@/lib/activity";

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
  const limited = await checkRateLimit(req, { prefix: "claim", limit: 5, window: "1 m" });
  if (limited) return limited;

  const url = new URL(req.url);
  const paymentHash = url.searchParams.get("paymentHash");

  // Require a payment hash
  if (!paymentHash || !/^[a-fA-F0-9]{64}$/.test(paymentHash)) {
    return Response.json(
      { error: { code: "invalid_param", message: "Valid paymentHash is required" } },
      { status: 400 },
    );
  }

  // Verify payment was actually made — fail closed
  let paid: boolean;
  try {
    paid = await isPaid(paymentHash);
  } catch {
    return Response.json(
      { error: { code: "service_unavailable", message: "Payment verification temporarily unavailable. Please retry." } },
      { status: 503 },
    );
  }

  if (!paid) {
    return Response.json(
      { error: { code: "payment_required", message: "No payment found for this hash" } },
      { status: 402 },
    );
  }

  // Check if already claimed via Redis (cross-instance safe)
  const redis = getRedis();
  if (!redis) {
    return Response.json(
      { error: { code: "service_unavailable", message: "Claim service temporarily unavailable. Please retry." } },
      { status: 503 },
    );
  }

  try {
    const val = await redis.get(`claim:${paymentHash}`);
    if (val !== null) {
      return Response.json(
        { error: { code: "already_claimed", message: "This payment has already been claimed" } },
        { status: 409 },
      );
    }
  } catch {
    return Response.json(
      { error: { code: "service_unavailable", message: "Claim service temporarily unavailable. Please retry." } },
      { status: 503 },
    );
  }

  // Atomically claim via SET NX — only one request wins
  try {
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
  } catch {
    return Response.json(
      { error: { code: "service_unavailable", message: "Claim service temporarily unavailable. Please retry." } },
      { status: 503 },
    );
  }

  const { deviceId, isNew } = getOrCreateDeviceId(req);
  const fortune = getRandomFortune();

  // Leaderboard + activity feed: record fortune + 100 sats (must await — serverless freezes after return)
  await Promise.all([
    recordFortuneReveal(deviceId, fortune.rarity, 100),
    recordActivity(deviceId, fortune.rarity),
  ]);

  const res = Response.json({
    fortune: fortune.text,
    rarity: fortune.rarity,
    timestamp: new Date().toISOString(),
    verified: true,
  });
  if (isNew) attachDeviceCookie(res, deviceId);
  return res;
}
