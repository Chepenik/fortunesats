import { isPaid } from "@/lib/payment-store";
import { getRandomFortune } from "@/lib/fortunes";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const paymentHash = url.searchParams.get("paymentHash");

  if (!paymentHash) {
    return Response.json(
      { error: { code: "missing_param", message: "paymentHash is required" } },
      { status: 400 },
    );
  }

  const paid = isPaid(paymentHash);

  if (paid) {
    return Response.json({
      paid,
      paymentHash,
      fortune: getRandomFortune(),
      timestamp: new Date().toISOString(),
    });
  }

  return Response.json({ paid, paymentHash });
}
