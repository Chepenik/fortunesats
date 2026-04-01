import { createOrder } from "@/lib/orders";
import { checkRateLimit } from "@/lib/ratelimit";
import { attachPackCookie } from "@/lib/pack-session";
import { getFlags, unavailableResponse } from "@/lib/flags";

/**
 * POST /api/pack — Create a new fortune-pack order.
 *
 * Returns the order details including the BTC address to pay.
 * Sets an HttpOnly cookie with the pack credentials so the
 * secret never needs to live in localStorage.
 */
export async function POST(req: Request) {
  const { fortunePackEnabled } = getFlags();
  if (!fortunePackEnabled) return unavailableResponse("Fortune Packs");
  const limited = await checkRateLimit(req, { prefix: "pack-create", limit: 3, window: "1 m" });
  if (limited) return limited;
  try {
    const order = await createOrder();

    const res = Response.json({
      orderId: order.id,
      secret: order.secret,
      address: order.address,
      amountSats: order.amountSats,
      fortunesTotal: order.fortunesTotal,
      expiresAt: order.expiresAt,
    });

    // Set HttpOnly cookie — client stores only orderId in localStorage
    attachPackCookie(res, order.id, order.secret);

    return res;
  } catch (e) {
    console.error("[pack/create] Error:", e);
    return Response.json(
      { error: { code: "create_failed", message: "Failed to create order" } },
      { status: 500 },
    );
  }
}
