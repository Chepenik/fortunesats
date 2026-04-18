import { getStrikeInvoice } from "@/lib/strike";
import { getRandomFortune } from "@/lib/fortunes";
import { getRedis } from "@/lib/redis";
import { checkRateLimit } from "@/lib/ratelimit";
import { getOrCreateDeviceId, attachDeviceCookie, resolveDisplayNameFromReq } from "@/lib/device-id";
import { recordFortuneOnce } from "@/lib/idempotency";
import { addToServerCollection, recordServerStreak } from "@/lib/collection-sync";
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

  // Server-side payment verification via Strike.
  // Never trusts Redis alone — always re-checks the live invoice.
  let invoice;
  try {
    invoice = await getStrikeInvoice(checkoutId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const isTimeout = msg.includes("timed out") || msg.includes("ETIMEDOUT");
    console.error(`[fortune/deliver:strike] checkoutId=${checkoutId} error=${msg}`);
    return Response.json(
      {
        error: {
          code: "service_unavailable",
          message: "Payment verification temporarily unavailable.",
          retriable: true,
          detail: isTimeout ? "sync_timeout" : "checkout_error",
        },
      },
      { status: 503, headers: { "Retry-After": "3" } },
    );
  }

  const paid = invoice.state === "PAID" && invoice.amount?.currency === "BTC";

  if (!paid) {
    console.warn(
      `[fortune/deliver] Payment not confirmed: checkoutId=${checkoutId} state=${invoice.state} currency=${invoice.amount?.currency}`,
    );
    return Response.json(
      { error: { code: "payment_required", message: "Payment not confirmed yet", retriable: true } },
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
  await Promise.all([
    recordFortuneOnce(checkoutId, deviceId, displayName, rarity, 100),
    addToServerCollection(deviceId, fortune, rarity),
    recordServerStreak(deviceId),
  ]);

  const res = Response.json({ fortune, rarity, timestamp });
  if (isNew) attachDeviceCookie(res, deviceId);
  return res;
}
