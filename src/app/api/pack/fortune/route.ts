import { getOrder, claimFortune } from "@/lib/orders";
import { getUniqueRandomFortune } from "@/lib/fortunes";
import { checkRateLimit } from "@/lib/ratelimit";
import { getOrCreateDeviceId, attachDeviceCookie, resolveDisplayNameFromReq } from "@/lib/device-id";
import { recordFortuneReveal } from "@/lib/leaderboard";
import { recordActivity } from "@/lib/activity";
import { resolvePackCredentials, attachClearPackCookie } from "@/lib/pack-session";

/**
 * POST /api/pack/fortune — Claim one fortune from a paid pack.
 *
 * Body: { orderId?, secret? }
 * Credentials come from the HttpOnly fsp cookie (preferred) or body (backward compat).
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

  // Resolve credentials: HttpOnly cookie first, body fallback
  const creds = resolvePackCredentials(req, body);
  if (!creds) {
    return Response.json(
      { error: { code: "invalid_params", message: "orderId and secret required" } },
      { status: 400 },
    );
  }

  const { orderId, secret } = creds;

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
      const res = Response.json(
        { error: { code: "depleted", message: "All fortunes in this pack have been claimed" } },
        { status: 410 },
      );
      attachClearPackCookie(res);
      return res;
    }

    // Pick a fortune the buyer hasn't seen yet
    const fortune = getUniqueRandomFortune(order.claimedFortunes);

    // Atomic claim: Redis DECR prevents over-claiming across concurrent requests
    const result = await claimFortune(orderId, secret, fortune.text);

    if (!result.success) {
      const res = Response.json(
        { error: { code: "claim_failed", message: result.error } },
        { status: 400 },
      );
      // Clear cookie if depleted
      if (result.error === "All fortunes claimed") {
        attachClearPackCookie(res);
      }
      return res;
    }

    // Leaderboard: record fortune reveal (sats=0, already tracked at pack payment)
    // Must await — serverless freezes after return
    const { deviceId, isNew } = getOrCreateDeviceId(req);
    const displayName = resolveDisplayNameFromReq(req, deviceId);
    await Promise.all([
      recordFortuneReveal(deviceId, displayName, fortune.rarity, 0),
      recordActivity(displayName, fortune.rarity),
    ]);

    const res = Response.json({
      fortune: fortune.text,
      rarity: fortune.rarity,
      timestamp: new Date().toISOString(),
      fortunesRemaining: result.fortunesRemaining,
      fortunesTotal: order.fortunesTotal,
    });
    if (isNew) attachDeviceCookie(res, deviceId);

    // Clear cookie when pack is depleted
    if (result.fortunesRemaining <= 0) {
      attachClearPackCookie(res);
    }

    return res;
  } catch (e) {
    console.error("[pack/fortune] Error:", e);
    return Response.json(
      { error: { code: "claim_failed", message: "Failed to claim fortune" } },
      { status: 500 },
    );
  }
}
