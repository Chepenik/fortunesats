import {
  getOrder,
  markOrderPaid,
  markOrderConfirmed,
} from "@/lib/orders";
import { verifyTxPayment, isTxConfirmed } from "@/lib/mempool";
import { checkRateLimit } from "@/lib/ratelimit";
import { getOrCreateDeviceId, attachDeviceCookie, resolveDisplayNameFromReq } from "@/lib/device-id";
import { recordSatsOnce } from "@/lib/idempotency";
import { resolvePackCredentials } from "@/lib/pack-session";

/**
 * POST /api/pack/status
 *
 * Body: { orderId?, secret?, txid? }
 *
 * Credentials come from the HttpOnly fsp cookie (preferred) or the body (backward compat).
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

  // Resolve credentials: HttpOnly cookie first, body fallback
  const creds = resolvePackCredentials(req, body);
  if (!creds) {
    return Response.json(
      { error: { code: "invalid_params", message: "orderId and secret required" } },
      { status: 400 },
    );
  }

  const { orderId, secret } = creds;
  const { txid } = body;

  try {
    const order = await getOrder(orderId, secret);
    if (!order) {
      return Response.json(
        { error: { code: "not_found", message: "Order not found" } },
        { status: 404 },
      );
    }

    // -- Already paid: check for confirmation upgrade --
    if (order.status === "mempool" && order.txid) {
      const { confirmed } = await isTxConfirmed(order.txid).catch(() => ({
        confirmed: false,
      }));
      if (confirmed) {
        try {
          await markOrderConfirmed(orderId);
        } catch (e) {
          // Non-critical: order stays "mempool" and will be upgraded on next poll
          console.error("[pack/status] markOrderConfirmed failed:", e);
        }
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

    // -- Pending: user submitted a txid to verify --
    if (order.status === "pending" && txid) {
      // Validate txid format (64 hex chars)
      if (!/^[a-fA-F0-9]{64}$/.test(txid)) {
        return Response.json(
          { error: { code: "invalid_txid", message: "Invalid transaction ID format. Must be 64 hex characters." } },
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

        // Record sats ONCE per order (Redis SET NX — safe on retries)
        const { deviceId, isNew } = getOrCreateDeviceId(req);
        const displayName = resolveDisplayNameFromReq(req, deviceId);
        await recordSatsOnce(orderId, deviceId, displayName, result.amountSats!);

        const res = Response.json({
          status: result.confirmed ? "confirmed" : "mempool",
          txid,
          txAmountSats: result.amountSats,
          fortunesRemaining: updated?.fortunesRemaining ?? order.fortunesRemaining,
          fortunesTotal: order.fortunesTotal,
          paidAt: new Date().toISOString(),
        });
        if (isNew) attachDeviceCookie(res, deviceId);
        return res;
      }
    }

    // -- Pending, no txid submitted --
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
