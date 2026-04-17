/**
 * POST /api/checkout — create a Strike invoice + quote for the fortune or
 * gift flow. Body: { purpose?: "fortune" | "gift" }, default "fortune".
 *
 * The pack flow has its own /api/pack Lightning path (it needs to mint an
 * Order side-effect alongside the Strike invoice), so it does not share
 * this route.
 */

import {
  createStrikeInvoice,
  createStrikeQuote,
  makeCorrelationId,
  saveCheckoutRecord,
  satsToBtcAmount,
  applyQuoteToRecord,
  type StrikeCheckoutRecord,
  type PurchaseType,
} from "@/lib/strike";
import { checkRateLimit } from "@/lib/ratelimit";
import { getFlags, unavailableResponse } from "@/lib/flags";
import { config } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CheckoutPurpose = Extract<PurchaseType, "fortune" | "gift">;

interface Spec {
  amountSats: number;
  description: string;
  successPath: string;
  purchaseType: PurchaseType;
}

function specFor(purpose: CheckoutPurpose): Spec {
  if (purpose === "gift") {
    return {
      amountSats: config.pricing.fortuneGift,
      description: "Fortune gift — Fortune Sats",
      successPath: "/gift/success",
      purchaseType: "gift",
    };
  }
  return {
    amountSats: config.pricing.fortuneSingle,
    description: "One fortune — Fortune Sats",
    successPath: "/fortune/success",
    purchaseType: "fortune",
  };
}

export async function POST(req: Request) {
  const { fortuneSingleEnabled, giftEnabled } = getFlags();

  const limited = await checkRateLimit(req, { prefix: "checkout", limit: 10, window: "1 m" });
  if (limited) return limited;

  let body: { purpose?: string } = {};
  try {
    body = (await req.json()) as { purpose?: string };
  } catch {
    // Empty body is allowed — defaults to fortune.
  }

  const purpose: CheckoutPurpose = body.purpose === "gift" ? "gift" : "fortune";

  if (purpose === "fortune" && !fortuneSingleEnabled) return unavailableResponse("Fortunes");
  if (purpose === "gift" && !giftEnabled) return unavailableResponse("Gift fortunes");

  const spec = specFor(purpose);
  const correlationId = makeCorrelationId();

  let invoice;
  let quote;
  try {
    invoice = await createStrikeInvoice({
      correlationId,
      description: spec.description,
      amountSats: spec.amountSats,
    });
    quote = await createStrikeQuote(invoice.invoiceId);
  } catch (e) {
    console.error("[checkout] Strike invoice/quote creation failed:", e instanceof Error ? e.message : e);
    return Response.json(
      {
        error: {
          code: "service_unavailable",
          message: "Could not create checkout. Please try again.",
          retriable: true,
        },
      },
      { status: 503, headers: { "Retry-After": "3" } },
    );
  }

  const now = Date.now();
  const baseRecord: StrikeCheckoutRecord = {
    invoiceId: invoice.invoiceId,
    correlationId,
    purchaseType: spec.purchaseType,
    amountSats: spec.amountSats,
    amountBtc: satsToBtcAmount(spec.amountSats),
    description: spec.description,
    state: invoice.state,
    successPath: spec.successPath,
    createdAt: now,
    lastSyncedAt: now,
  };
  const record = applyQuoteToRecord(baseRecord, quote, now);
  await saveCheckoutRecord(record);

  return Response.json({
    checkoutId: invoice.invoiceId,
    checkoutUrl: `/checkout/${invoice.invoiceId}`,
    purpose,
  });
}
