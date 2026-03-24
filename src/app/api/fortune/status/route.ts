import { isPaid } from "@/lib/payment-store";
import { getRandomFortune } from "@/lib/fortunes";

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
    return Response.json({
      paid: true,
      paymentHash,
      fortune: getRandomFortune(),
      timestamp: new Date().toISOString(),
    });
  }

  return Response.json({ paid: false, paymentHash });
}
