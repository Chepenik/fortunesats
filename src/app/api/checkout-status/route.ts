/**
 * GET /api/checkout-status?id=... — return the current presentation of
 * a Strike checkout. If the record is not in a terminal state we sync
 * with Strike first so pollers surface webhook-free state changes.
 */

import {
  applyInvoiceToRecord,
  getCheckoutRecord,
  getStrikeInvoice,
  saveCheckoutRecord,
  type StrikeCheckoutRecord,
} from "@/lib/strike";
import { checkRateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isTerminal(state: StrikeCheckoutRecord["state"]): boolean {
  return state === "PAID" || state === "CANCELLED";
}

export async function GET(req: Request) {
  const limited = await checkRateLimit(req, { prefix: "checkout-status", limit: 60, window: "1 m" });
  if (limited) return limited;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return Response.json(
      { error: { code: "invalid_param", message: "id is required" } },
      { status: 400 },
    );
  }

  let record = await getCheckoutRecord(id);
  if (!record) {
    return Response.json(
      { error: { code: "not_found", message: "Checkout not found" } },
      { status: 404 },
    );
  }

  if (!isTerminal(record.state)) {
    try {
      const invoice = await getStrikeInvoice(id);
      const next = applyInvoiceToRecord(record, invoice);
      if (next.state !== record.state || next.paidAt !== record.paidAt) {
        await saveCheckoutRecord(next);
      }
      record = next;
    } catch (e) {
      // Non-fatal — keep returning the cached record so the UI still renders.
      console.warn("[checkout-status] Strike sync failed:", e instanceof Error ? e.message : e);
    }
  }

  const now = Math.floor(Date.now() / 1000);
  return Response.json({
    invoiceId: record.invoiceId,
    state: record.state,
    paid: record.state === "PAID",
    quoteExpiresAt: record.quoteExpiresAt ?? null,
    quoteExpired: record.quoteExpiresAt ? record.quoteExpiresAt <= now : false,
    lnInvoice: record.latestLnInvoice ?? null,
    amountSats: record.amountSats,
    description: record.description,
  });
}
