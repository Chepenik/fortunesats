import { getCheckout } from "@moneydevkit/core";
import { getRedis } from "@/lib/redis";
import { checkRateLimit } from "@/lib/ratelimit";
import { getOrCreateDeviceId, attachDeviceCookie, resolveDisplayNameFromReq } from "@/lib/device-id";
import { recordFortuneOnce } from "@/lib/idempotency";
import { createGift } from "@/lib/gift";
import { config } from "@/lib/config";
import { getFlags, unavailableResponse } from "@/lib/flags";

export async function POST(req: Request) {
  const { giftEnabled } = getFlags();
  if (!giftEnabled) return unavailableResponse("Gift fortunes");

  const limited = await checkRateLimit(req, { prefix: "gift-create", limit: 10, window: "1 m" });
  if (limited) return limited;

  let body: { checkoutId?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { error: { code: "invalid_body", message: "JSON body required" } },
      { status: 400 },
    );
  }

  const { checkoutId } = body;
  if (!checkoutId || typeof checkoutId !== "string") {
    return Response.json(
      { error: { code: "invalid_param", message: "checkoutId is required" } },
      { status: 400 },
    );
  }

  // Server-side payment verification via MDK
  let checkout;
  try {
    checkout = await getCheckout(checkoutId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[gift/create:getCheckout] checkoutId=${checkoutId} error=${msg}`);
    return Response.json(
      {
        error: {
          code: "service_unavailable",
          message: "Payment verification temporarily unavailable.",
          retriable: true,
        },
      },
      { status: 503, headers: { "Retry-After": "3" } },
    );
  }

  const paid =
    checkout.status === "PAYMENT_RECEIVED" ||
    (checkout.invoice?.amountSatsReceived ?? 0) > 0;

  if (!paid) {
    return Response.json(
      { error: { code: "payment_required", message: "Payment not confirmed yet", retriable: true } },
      { status: 402 },
    );
  }

  const redis = getRedis();
  if (!redis) {
    return Response.json(
      { error: { code: "service_unavailable", message: "Gift service requires Redis" } },
      { status: 503 },
    );
  }

  // Create gift (idempotent per checkoutId)
  const { deviceId, isNew } = getOrCreateDeviceId(req);
  const gift = await createGift(checkoutId, deviceId);

  if (!gift) {
    return Response.json(
      { error: { code: "creation_failed", message: "Failed to create gift" } },
      { status: 500 },
    );
  }

  // Record to leaderboard/activity (idempotent, uses gift price)
  const displayName = resolveDisplayNameFromReq(req, deviceId);
  await recordFortuneOnce(checkoutId, deviceId, displayName, gift.rarity, config.pricing.fortuneGift);

  const res = Response.json({
    token: gift.token,
    rarity: gift.rarity,
    expiresAt: gift.expiresAt,
  });
  if (isNew) attachDeviceCookie(res, deviceId);
  return res;
}
