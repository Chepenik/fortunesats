/**
 * POST /api/checkout/quote — mint a fresh Lightning quote for an existing
 * UNPAID Strike invoice. Wrapped in a 10s NX lock so concurrent pollers
 * don't burn multiple quotes.
 */

import {
  acquireQuoteLock,
  applyQuoteToRecord,
  createStrikeQuote,
  getCheckoutRecord,
  saveCheckoutRecord,
} from "@/lib/strike";
import { checkRateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const limited = await checkRateLimit(req, { prefix: "checkout-quote", limit: 20, window: "1 m" });
  if (limited) return limited;

  let body: { id?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { error: { code: "invalid_body", message: "JSON body required" } },
      { status: 400 },
    );
  }
  const { id } = body;
  if (!id || typeof id !== "string") {
    return Response.json(
      { error: { code: "invalid_param", message: "id is required" } },
      { status: 400 },
    );
  }

  const record = await getCheckoutRecord(id);
  if (!record) {
    return Response.json(
      { error: { code: "not_found", message: "Checkout not found" } },
      { status: 404 },
    );
  }
  if (record.state !== "UNPAID") {
    // Already paid/cancelled — don't issue a new quote.
    return Response.json(checkoutPresentation(record));
  }

  const locked = await acquireQuoteLock(id);
  if (!locked) {
    // Another poller is already refreshing — return the current record.
    return Response.json(checkoutPresentation(record));
  }

  let quote;
  try {
    quote = await createStrikeQuote(id);
  } catch (e) {
    console.error("[checkout/quote] Strike quote refresh failed:", e instanceof Error ? e.message : e);
    return Response.json(
      { error: { code: "service_unavailable", message: "Could not refresh quote." } },
      { status: 503 },
    );
  }

  const next = applyQuoteToRecord(record, quote);
  await saveCheckoutRecord(next);

  return Response.json(checkoutPresentation(next));
}

function checkoutPresentation(record: import("@/lib/strike").StrikeCheckoutRecord) {
  const now = Math.floor(Date.now() / 1000);
  return {
    invoiceId: record.invoiceId,
    state: record.state,
    paid: record.state === "PAID",
    quoteExpiresAt: record.quoteExpiresAt ?? null,
    quoteExpired: record.quoteExpiresAt ? record.quoteExpiresAt <= now : false,
    lnInvoice: record.latestLnInvoice ?? null,
    amountSats: record.amountSats,
    description: record.description,
  };
}
