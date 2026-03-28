import { withPayment } from "@moneydevkit/nextjs/server";
import { getRandomFortune } from "@/lib/fortunes";

const handler = async () => {
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
