import { createOrder } from "@/lib/orders";

/**
 * POST /api/pack — Create a new fortune-pack order.
 *
 * Returns the order details including the BTC address to pay.
 */
export async function POST() {
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
