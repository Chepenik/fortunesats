import { withPayment } from "@moneydevkit/nextjs/server";
import { getRandomFortune } from "@/lib/fortunes";
import { checkRateLimit } from "@/lib/ratelimit";
import { getOrCreateDeviceId, attachDeviceCookie, resolveDisplayNameFromReq } from "@/lib/device-id";
import { recordFortuneReveal } from "@/lib/leaderboard";
import { recordActivity } from "@/lib/activity";

const handler = async (req: Request) => {
  const limited = await checkRateLimit(req, { prefix: "fortune", limit: 10, window: "1 m" });
  if (limited) return limited;

  const { deviceId, isNew } = getOrCreateDeviceId(req);
  const displayName = resolveDisplayNameFromReq(req, deviceId);
  const fortune = getRandomFortune();

  // Leaderboard + activity feed: record fortune + 100 sats (must await — serverless freezes after return)
  await Promise.all([
    recordFortuneReveal(deviceId, displayName, fortune.rarity, 100),
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

export const GET = withPayment({ amount: 100, currency: "SAT" }, handler);

// MDK's LDK node needs time to build + sync on cold start
export const maxDuration = 60;
