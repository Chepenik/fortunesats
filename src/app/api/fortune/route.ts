import { withPayment } from "@moneydevkit/nextjs/server";
import { getRandomFortune } from "@/lib/fortunes";

const handler = async () => {
  return Response.json({
    fortune: getRandomFortune(),
    timestamp: new Date().toISOString(),
  });
};

export const GET = withPayment({ amount: 10, currency: "SAT" }, handler);
