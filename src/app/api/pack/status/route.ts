import {
  getOrder,
  markOrderPaid,
  markOrderConfirmed,
} from "@/lib/orders";
import { verifyTxPayment, isTxConfirmed } from "@/lib/mempool";
import { checkRateLimit } from "@/lib/ratelimit";

/**
 * POST /api/pack/status
 *
 * Body: { orderId, secret, txid? }
 *
 * If txid is provided: verifies that specific tx pays the correct address/amount.
 * If txid is omitted and order is already paid: checks for confirmation upgrade.
 */
export async function POST(req: Request) {
  const limited = await checkRateLimit(req, { prefix: "pack-status", limit: 20, window: "1 m" });
  if (limited) return limited;

  let body: { orderId?: string; secret?: string; txid?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { error: { code: "invalid_body", message: "Invalid JSON body" } },
      { status: 400 },
    );
  }

  const { orderId, secret, txid } = body;

  if (!orderId || !secret) {
    return Response.json(
      { error: { code: "invalid_params", message: "orderId and secret required" } },
      { status: 400 },
    );
  }

  try {
    const order = await getOrder(orderId, secret);
    if (!order) {
      return Response.json(
        { error: { code: "not_found", message: "Order not found" } },
        { status: 404 },
      );
    }

    // ── Already paid: check for confirmation upgrade ──
    if (order.status === "mempool" && order.txid) {
      const { confirmed } = await isTxConfirmed(order.txid).catch(() => ({
        confirmed: false,
      }));
      if (confirmed) {
        await markOrderConfirmed(orderId);
        return Response.json({
          status: "confirmed",
          txid: order.txid,
          txAmountSats: order.txAmountSats,
          fortunesRemaining: order.fortunesRemaining,
          fortunesTotal: order.fortunesTotal,
          paidAt: order.paidAt,
          confirmedAt: new Date().toISOString(),
        });
      }
      return Response.json({
        status: "mempool",
        txid: order.txid,
        txAmountSats: order.txAmountSats,
        fortunesRemaining: order.fortunesRemaining,
        fortunesTotal: order.fortunesTotal,
        paidAt: order.paidAt,
      });
    }

    if (order.status === "confirmed") {
      return Response.json({
        status: "confirmed",
        txid: order.txid,
        txAmountSats: order.txAmountSats,
        fortunesRemaining: order.fortunesRemaining,
        fortunesTotal: order.fortunesTotal,
        paidAt: order.paidAt,
        confirmedAt: order.confirmedAt,
      });
    }

    // ── Pending: user submitted a txid to verify ──
    if (order.status === "pending" && txid) {
      // Validate txid format (64 hex chars)
      if (!/^[a-fA-F0-9]{64}$/.test(txid)) {
        return Response.json(
          { error: { code: "invalid_txid", message: "Invalid transaction ID format" } },
          { status: 400 },
        );
      }

      const result = await verifyTxPayment(txid, order.address, order.amountSats);

      if (result.error) {
        return Response.json(
          { error: { code: "tx_verification_failed", message: result.error } },
          { status: 400 },
        );
      }

      if (result.valid) {
        const updated = await markOrderPaid(orderId, txid, result.amountSats!);
        return Response.json({
          status: result.confirmed ? "confirmed" : "mempool",
          txid,
          txAmountSats: result.amountSats,
          fortunesRemaining: updated?.fortunesRemaining ?? order.fortunesRemaining,
          fortunesTotal: order.fortunesTotal,
          paidAt: new Date().toISOString(),
        });
      }
    }

    // ── Pending, no txid submitted ──
    const expired = new Date(order.expiresAt) < new Date();

    return Response.json({
      status: "pending",
      address: order.address,
      amountSats: order.amountSats,
      expired,
      expiresAt: order.expiresAt,
    });
  } catch (e) {
    console.error("[pack/status] Error:", e);
    return Response.json(
      { error: { code: "status_failed", message: "Failed to check status" } },
      { status: 500 },
    );
  }
}
