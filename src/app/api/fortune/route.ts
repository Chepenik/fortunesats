import { withPayment } from "@moneydevkit/nextjs/server";
import { getRandomFortune } from "@/lib/fortunes";

const handler = async () => {
  return Response.json({
    fortune: getRandomFortune(),
    timestamp: new Date().toISOString(),
  });
};

export const GET = withPayment({ amount: 100, currency: "SAT" }, handler);

// MDK's LDK node needs time to build + sync on cold start
export const maxDuration = 60;
