import { getOrder, claimFortune } from "@/lib/orders";
import { getUniqueRandomFortune } from "@/lib/fortunes";
import { checkRateLimit } from "@/lib/ratelimit";
import { getOrCreateDeviceId, attachDeviceCookie } from "@/lib/device-id";
import { recordFortuneReveal } from "@/lib/leaderboard";
import { recordActivity } from "@/lib/activity";

/**
 * POST /api/pack/fortune — Claim one fortune from a paid pack.
 *
 * Body: { orderId: string, secret: string }
 */
export async function POST(req: Request) {
  const limited = await checkRateLimit(req, { prefix: "pack-fortune", limit: 10, window: "1 m" });
  if (limited) return limited;

  let body: { orderId?: string; secret?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { error: { code: "invalid_body", message: "Invalid JSON body" } },
      { status: 400 },
    );
  }

  const { orderId, secret } = body;
  if (!orderId || !secret) {
    return Response.json(
      { error: { code: "invalid_params", message: "orderId and secret required" } },
      { status: 400 },
    );
  }

  try {
    const order = await getOrder(orderId, secret);
    if (!order) {
      return Response.json(
        { error: { code: "not_found", message: "Order not found" } },
        { status: 404 },
      );
    }

    if (order.status !== "mempool" && order.status !== "confirmed") {
      return Response.json(
        { error: { code: "not_paid", message: "Order not yet paid" } },
        { status: 402 },
      );
    }

    if (order.fortunesRemaining <= 0) {
      return Response.json(
        { error: { code: "depleted", message: "All fortunes in this pack have been claimed" } },
        { status: 410 },
      );
    }

    // Pick a fortune the buyer hasn't seen yet
    const fortune = getUniqueRandomFortune(order.claimedFortunes);
    const result = await claimFortune(orderId, secret, fortune.text);

    if (!result.success) {
      return Response.json(
        { error: { code: "claim_failed", message: result.error } },
        { status: 400 },
      );
    }

    // Leaderboard: record fortune reveal (sats=0, already tracked at pack payment)
    // Must await — serverless freezes after return
    const { deviceId, isNew } = getOrCreateDeviceId(req);
    await Promise.all([
      recordFortuneReveal(deviceId, fortune.rarity, 0),
      recordActivity(deviceId, fortune.rarity),
    ]);

    const res = Response.json({
      fortune: fortune.text,
      rarity: fortune.rarity,
      timestamp: new Date().toISOString(),
      fortunesRemaining: result.fortunesRemaining,
      fortunesTotal: order.fortunesTotal,
    });
    if (isNew) attachDeviceCookie(res, deviceId);
    return res;
  } catch (e) {
    console.error("[pack/fortune] Error:", e);
    return Response.json(
      { error: { code: "claim_failed", message: "Failed to claim fortune" } },
      { status: 500 },
    );
  }
}
