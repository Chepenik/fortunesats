/**
 * POST /api/strike/webhook — Strike invoice state notifications.
 *
 * Flow: verify HMAC → 401 on fail → dedupe by event id in Redis → refetch
 * invoice from Strike → update the checkout record. No side effect runs
 * before the signature is verified.
 *
 * The signature is HMAC-SHA256 over the raw JSON body, hex-encoded,
 * in the `x-webhook-signature` header.
 */

import {
  applyInvoiceToRecord,
  claimWebhookEvent,
  getCheckoutRecord,
  getStrikeInvoice,
  saveCheckoutRecord,
  verifyStrikeWebhookSignature,
  type StrikeWebhookPayload,
} from "@/lib/strike";
import { getOrderIdByStrikeInvoice, markOrderLightningPaid } from "@/lib/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "iad1";
export const maxDuration = 60;

export async function POST(req: Request) {
  // Read raw text so we can verify against the exact bytes Strike signed.
  const rawBody = await req.text();

  let payload: StrikeWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as StrikeWebhookPayload;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const signature = req.headers.get("x-webhook-signature");
  if (!verifyStrikeWebhookSignature(payload, signature)) {
    // Do not log signature details — could leak attempted forgery attempts.
    console.warn("[strike-webhook] Signature verification failed");
    return new Response("Unauthorized", { status: 401 });
  }

  // Dedupe: if we've already processed this event id, acknowledge and exit.
  const firstTime = await claimWebhookEvent(payload.id);
  if (!firstTime) {
    return Response.json({ ok: true, deduped: true });
  }

  if (payload.eventType !== "invoice.updated") {
    // Accept but ignore other event types — Strike may send new ones over time.
    return Response.json({ ok: true, ignored: payload.eventType });
  }

  const invoiceId = payload.data?.entityId;
  if (!invoiceId) {
    return Response.json({ ok: true, noop: "missing entityId" });
  }

  try {
    const invoice = await getStrikeInvoice(invoiceId);
    const record = await getCheckoutRecord(invoiceId);
    if (record) {
      const next = applyInvoiceToRecord(record, invoice);
      await saveCheckoutRecord(next);

      // Pack flow: mark the order Lightning-paid so /api/pack/status and
      // /api/pack/fortune can release fortunes. markOrderLightningPaid is
      // idempotent so the poller and webhook can both drive this without
      // corrupting state.
      if (next.purchaseType === "fortune-pack" && next.state === "PAID") {
        const orderId =
          next.orderId ?? (await getOrderIdByStrikeInvoice(invoiceId));
        if (orderId) {
          await markOrderLightningPaid(orderId);
        }
      }
    }
    // If we don't have a record (e.g. the webhook arrived before our
    // create returned, or Redis expired the record), we still ACK 200 —
    // the /success unlock re-verifies against Strike directly anyway.
  } catch (e) {
    console.error("[strike-webhook] processing failed:", e instanceof Error ? e.message : e);
    // Return 500 so Strike retries the delivery.
    return new Response("processing failed", { status: 500 });
  }

  return Response.json({ ok: true });
}
