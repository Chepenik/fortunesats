import { consumePayment } from "@/lib/payment-store";
import { getRandomFortune } from "@/lib/fortunes";

const PAYMENT_HASH_RE = /^[a-f0-9]{64}$/i;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const paymentHash = url.searchParams.get("paymentHash");

  if (!paymentHash || !PAYMENT_HASH_RE.test(paymentHash)) {
    return Response.json(
      { error: { code: "invalid_param", message: "Valid paymentHash is required" } },
      { status: 400 },
    );
  }

  const valid = consumePayment(paymentHash);

  if (valid) {
    return Response.json({
      paid: true,
      paymentHash,
      fortune: getRandomFortune(),
      timestamp: new Date().toISOString(),
    });
  }

  return Response.json({ paid: false, paymentHash });
}
