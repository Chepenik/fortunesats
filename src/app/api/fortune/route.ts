import { withPayment } from "@moneydevkit/nextjs/server";
import { getRandomFortune } from "@/lib/fortunes";
import { checkRateLimit } from "@/lib/ratelimit";
import { getOrCreateDeviceId, attachDeviceCookie, resolveDisplayNameFromReq } from "@/lib/device-id";
import { recordFortuneReveal } from "@/lib/leaderboard";
import { recordActivity } from "@/lib/activity";
import { getFlags, unavailableResponse } from "@/lib/flags";

const handler = async (req: Request) => {
  const limited = await checkRateLimit(req, { prefix: "fortune", limit: 10, window: "1 m" });
  if (limited) return limited;

  const { freeFortunePromo } = getFlags();
  const sats = freeFortunePromo ? 0 : 100;

  const { deviceId, isNew } = getOrCreateDeviceId(req);
  const displayName = resolveDisplayNameFromReq(req, deviceId);
  const fortune = getRandomFortune();

  // Leaderboard + activity feed: record fortune + sats (0 during promo)
  // Must await — serverless freezes after return
  await Promise.all([
    recordFortuneReveal(deviceId, displayName, fortune.rarity, sats),
    recordActivity(displayName, fortune.rarity),
  ]);

  const res = Response.json({
    fortune: fortune.text,
    rarity: fortune.rarity,
    timestamp: new Date().toISOString(),
  });
  if (isNew) attachDeviceCookie(res, deviceId);
  return res;
};

const paidHandler = withPayment({ amount: 100, currency: "SAT" }, handler);

export async function GET(req: Request) {
  const { fortuneSingleEnabled, freeFortunePromo } = getFlags();
  if (!fortuneSingleEnabled) return unavailableResponse("Fortunes");
  if (freeFortunePromo) return handler(req);
  try {
    return await paidHandler(req);
  } catch (e) {
    // MDK/LDK failures (cold-start sync timeout, node init errors).
    // Client falls back to /fortune/status + /fortune/claim polling.
    console.error("[fortune:GET] MDK handler error:", e);
    return Response.json(
      { error: { code: "payment_unavailable", message: "Payment processing temporarily unavailable. Please retry shortly." } },
      { status: 503, headers: { "Retry-After": "5" } },
    );
  }
}

// MDK's LDK node needs time to build + sync on cold start
export const maxDuration = 60;
