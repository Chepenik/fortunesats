import { getCheckout } from "@moneydevkit/core";
import { getRandomFortune } from "@/lib/fortunes";
import { getRedis } from "@/lib/redis";
import { checkRateLimit } from "@/lib/ratelimit";
import { getOrCreateDeviceId, attachDeviceCookie, resolveDisplayNameFromReq } from "@/lib/device-id";
import { recordFortuneOnce } from "@/lib/idempotency";
import { getFlags, unavailableResponse } from "@/lib/flags";

const FORTUNE_TTL = 86_400; // 24 hours

export async function POST(req: Request) {
  const { fortuneSingleEnabled } = getFlags();
  if (!fortuneSingleEnabled) return unavailableResponse("Fortunes");

  const limited = await checkRateLimit(req, { prefix: "deliver", limit: 10, window: "1 m" });
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
    console.error("[fortune/deliver:getCheckout]", e);
    return Response.json(
      { error: { code: "service_unavailable", message: "Payment verification temporarily unavailable." } },
      { status: 503 },
    );
  }

  const paid =
    checkout.status === "PAYMENT_RECEIVED" ||
    (checkout.invoice?.amountSatsReceived ?? 0) > 0;

  if (!paid) {
    return Response.json(
      { error: { code: "payment_required", message: "Payment not confirmed" } },
      { status: 402 },
    );
  }

  // Generate or retrieve cached fortune for this checkout
  const redis = getRedis();
  let fortune: string;
  let rarity: import("@/lib/fortunes").Rarity;
  let timestamp: string;

  const cacheKey = `fortune:checkout:${checkoutId}`;

  if (redis) {
    try {
      const cached = await redis.get<{ fortune: string; rarity?: string; timestamp: string }>(cacheKey);
      if (cached) {
        fortune = cached.fortune;
        rarity = (cached.rarity as import("@/lib/fortunes").Rarity) ?? "common";
        timestamp = cached.timestamp;
      } else {
        const f = getRandomFortune();
        fortune = f.text;
        rarity = f.rarity;
        timestamp = new Date().toISOString();
        await redis.set(cacheKey, { fortune, rarity, timestamp }, { ex: FORTUNE_TTL });
      }
    } catch (e) {
      console.error("[fortune/deliver:cache]", e);
      const f = getRandomFortune();
      fortune = f.text;
      rarity = f.rarity;
      timestamp = new Date().toISOString();
    }
  } else {
    const f = getRandomFortune();
    fortune = f.text;
    rarity = f.rarity;
    timestamp = new Date().toISOString();
  }

  // Record to leaderboard/activity once per checkout (idempotent)
  const { deviceId, isNew } = getOrCreateDeviceId(req);
  const displayName = resolveDisplayNameFromReq(req, deviceId);
  await recordFortuneOnce(checkoutId, deviceId, displayName, rarity, 100);

  const res = Response.json({ fortune, rarity, timestamp });
  if (isNew) attachDeviceCookie(res, deviceId);
  return res;
}
