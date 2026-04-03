import { getRandomFortune } from "@/lib/fortunes";
import { checkRateLimit } from "@/lib/ratelimit";
import { getOrCreateDeviceId, attachDeviceCookie, resolveDisplayNameFromReq } from "@/lib/device-id";
import { recordFortuneReveal } from "@/lib/leaderboard";
import { recordActivity } from "@/lib/activity";
import { getFlags, unavailableResponse } from "@/lib/flags";

/**
 * Free fortune endpoint (promo mode only).
 * Paid fortunes now go through the MDK checkout flow:
 *   createCheckout → /checkout/[id] → /fortune/success → POST /api/fortune/deliver
 */
export async function GET(req: Request) {
  const { fortuneSingleEnabled, freeFortunePromo } = getFlags();
  if (!fortuneSingleEnabled) return unavailableResponse("Fortunes");

  if (!freeFortunePromo) {
    return Response.json(
      { error: { code: "payment_required", message: "Use the checkout flow to purchase a fortune." } },
      { status: 402 },
    );
  }

  const limited = await checkRateLimit(req, { prefix: "fortune", limit: 10, window: "1 m" });
  if (limited) return limited;

  const { deviceId, isNew } = getOrCreateDeviceId(req);
  const displayName = resolveDisplayNameFromReq(req, deviceId);
  const fortune = getRandomFortune();

  await Promise.all([
    recordFortuneReveal(deviceId, displayName, fortune.rarity, 0),
    recordActivity(displayName, fortune.rarity),
  ]);

  const res = Response.json({
    fortune: fortune.text,
    rarity: fortune.rarity,
    timestamp: new Date().toISOString(),
  });
  if (isNew) attachDeviceCookie(res, deviceId);
  return res;
}
