import { createOrder } from "@/lib/orders";
import { checkRateLimit } from "@/lib/ratelimit";

/**
 * POST /api/pack — Create a new fortune-pack order.
 *
 * Returns the order details including the BTC address to pay.
 */
export async function POST(req: Request) {
  const limited = await checkRateLimit(req, { prefix: "pack-create", limit: 3, window: "1 m" });
  if (limited) return limited;
  try {
    const order = await createOrder();

    return Response.json({
      orderId: order.id,
      secret: order.secret,
      address: order.address,
      amountSats: order.amountSats,
      fortunesTotal: order.fortunesTotal,
      expiresAt: order.expiresAt,
    });
  } catch (e) {
    console.error("[pack/create] Error:", e);
    return Response.json(
      { error: { code: "create_failed", message: "Failed to create order" } },
      { status: 500 },
    );
  }
}
