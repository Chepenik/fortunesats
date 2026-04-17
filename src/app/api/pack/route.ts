/**
 * POST /api/pack — Create a new fortune-pack order.
 *
 * Body: { rail?: "onchain" | "lightning" } — defaults to "lightning".
 *
 * Lightning rail (default): mints a Strike invoice + quote and returns
 * a checkoutUrl the client navigates to. After payment the Strike webhook
 * marks the order "lightning-paid" and the buyer returns to /pack to reveal.
 *
 * On-chain rail: returns the BTC address + required amount. Existing
 * mempool-watcher flow; unchanged.
 *
 * Both rails set an HttpOnly pack cookie so the secret never hits
 * localStorage.
 */

import {
  createOrder,
  setStrikeInvoiceOrderMapping,
  PACK_SIZE,
} from "@/lib/orders";
import { checkRateLimit } from "@/lib/ratelimit";
import { attachPackCookie } from "@/lib/pack-session";
import { getFlags, unavailableResponse } from "@/lib/flags";
import {
  applyQuoteToRecord,
  createStrikeInvoice,
  createStrikeQuote,
  makeCorrelationId,
  saveCheckoutRecord,
  satsToBtcAmount,
  type StrikeCheckoutRecord,
} from "@/lib/strike";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PackRail = "onchain" | "lightning";

export async function POST(req: Request) {
  const { fortunePackEnabled } = getFlags();
  if (!fortunePackEnabled) return unavailableResponse("Fortune Packs");
  const limited = await checkRateLimit(req, { prefix: "pack-create", limit: 3, window: "1 m" });
  if (limited) return limited;

  let body: { rail?: string } = {};
  try {
    body = (await req.json()) as { rail?: string };
  } catch {
    // Empty body OK — defaults below.
  }
  const rail: PackRail = body.rail === "onchain" ? "onchain" : "lightning";

  try {
    if (rail === "lightning") {
      const correlationId = makeCorrelationId();
      const description = `Fortune Pack — ${PACK_SIZE} fortunes`;

      // Create Strike invoice + quote first so order creation can be rolled
      // back cheaply (Redis set) if Strike is unavailable.
      const invoice = await createStrikeInvoice({
        correlationId,
        description,
        amountSats: 10_000,
      });
      const quote = await createStrikeQuote(invoice.invoiceId);

      const order = await createOrder({
        rail: "lightning",
        strikeInvoiceId: invoice.invoiceId,
      });

      const now = Date.now();
      const baseRecord: StrikeCheckoutRecord = {
        invoiceId: invoice.invoiceId,
        correlationId,
        purchaseType: "fortune-pack",
        amountSats: order.amountSats,
        amountBtc: satsToBtcAmount(order.amountSats),
        description,
        state: invoice.state,
        successPath: "/pack",
        orderId: order.id,
        createdAt: now,
        lastSyncedAt: now,
      };
      const record = applyQuoteToRecord(baseRecord, quote, now);
      await saveCheckoutRecord(record);
      await setStrikeInvoiceOrderMapping(invoice.invoiceId, order.id);

      const res = Response.json({
        orderId: order.id,
        secret: order.secret,
        rail,
        amountSats: order.amountSats,
        fortunesTotal: order.fortunesTotal,
        expiresAt: order.expiresAt,
        checkoutId: invoice.invoiceId,
        checkoutUrl: `/checkout/${invoice.invoiceId}`,
      });
      attachPackCookie(res, order.id, order.secret);
      return res;
    }

    // On-chain rail (unchanged shape).
    const order = await createOrder({ rail: "onchain" });
    const res = Response.json({
      orderId: order.id,
      secret: order.secret,
      rail,
      address: order.address,
      amountSats: order.amountSats,
      fortunesTotal: order.fortunesTotal,
      expiresAt: order.expiresAt,
    });
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
