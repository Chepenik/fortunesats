import { isPaid } from "@/lib/payment-store";
import { getRandomFortune } from "@/lib/fortunes";

/**
 * Cache generated fortunes per payment hash so repeated "I've Paid"
 * clicks return the same fortune instead of generating a new one.
 */
const fortuneCache = new Map<string, { fortune: string; timestamp: string }>();

export async function GET(req: Request) {
  const url = new URL(req.url);
  const paymentHash = url.searchParams.get("paymentHash");

  if (!paymentHash || paymentHash.length > 256) {
    return Response.json(
      { error: { code: "invalid_param", message: "paymentHash is required" } },
      { status: 400 },
    );
  }

  const paid = isPaid(paymentHash);

  if (paid) {
    // Return cached fortune if we already generated one for this hash
    let cached = fortuneCache.get(paymentHash);
    if (!cached) {
      cached = { fortune: getRandomFortune(), timestamp: new Date().toISOString() };
      fortuneCache.set(paymentHash, cached);
    }

    return Response.json({
      paid: true,
      paymentHash,
      fortune: cached.fortune,
      timestamp: cached.timestamp,
    });
  }

  return Response.json({ paid: false, paymentHash });
}
