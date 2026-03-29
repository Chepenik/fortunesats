import { withPayment } from "@moneydevkit/nextjs/server";
import { getRandomFortune } from "@/lib/fortunes";
import { checkRateLimit } from "@/lib/ratelimit";

const handler = async (req: Request) => {
  const limited = await checkRateLimit(req, { prefix: "fortune", limit: 10, window: "1 m" });
  if (limited) return limited;

  const fortune = getRandomFortune();
  return Response.json({
    fortune: fortune.text,
    rarity: fortune.rarity,
    timestamp: new Date().toISOString(),
  });
};

export const GET = withPayment({ amount: 100, currency: "SAT" }, handler);

// MDK's LDK node needs time to build + sync on cold start
export const maxDuration = 60;
