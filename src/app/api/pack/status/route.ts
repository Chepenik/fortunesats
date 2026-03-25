import {
  getOrder,
  markOrderPaid,
  markOrderConfirmed,
  isTxidAssigned,
  getPendingOrdersList,
  getOrderUnsafe,
  PACK_PRICE_SATS,
} from "@/lib/orders";
import {
  getMempoolTransactions,
  getConfirmedTransactions,
  isTxConfirmed,
} from "@/lib/mempool";

/**
 * GET /api/pack/status?orderId=X&secret=Y
 *
 * Checks payment status for an order.
 * When pending: polls mempool.space for incoming transactions.
 * When mempool-detected: optionally checks for confirmation upgrade.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const orderId = url.searchParams.get("orderId");
  const secret = url.searchParams.get("secret");

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

    // Already paid — check for confirmation upgrade
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

    // Pending — scan mempool.space for incoming payments
    if (order.status === "pending") {
      const tx = await scanForPayment(order.address, orderId);
      if (tx) {
        const updated = await markOrderPaid(orderId, tx.txid, tx.amountSats);
        return Response.json({
          status: "mempool",
          txid: tx.txid,
          txAmountSats: tx.amountSats,
          fortunesRemaining: updated?.fortunesRemaining ?? order.fortunesRemaining,
          fortunesTotal: order.fortunesTotal,
          paidAt: new Date().toISOString(),
        });
      }

      // Check if expired (UI guidance only)
      const expired = new Date(order.expiresAt) < new Date();

      return Response.json({
        status: "pending",
        address: order.address,
        amountSats: order.amountSats,
        expired,
        expiresAt: order.expiresAt,
      });
    }

    return Response.json({ status: order.status });
  } catch (e) {
    console.error("[pack/status] Error:", e);
    return Response.json(
      { error: { code: "status_failed", message: "Failed to check status" } },
      { status: 500 },
    );
  }
}

/**
 * Scan mempool.space for a payment to {address} that matches this order.
 *
 * Strategy: find any tx to the address with value >= PACK_PRICE_SATS
 * that hasn't already been assigned to another order.
 * Assigns to the oldest pending order (FIFO).
 */
async function scanForPayment(
  address: string,
  orderId: string,
): Promise<{ txid: string; amountSats: number } | null> {
  try {
    // Check mempool txs first
    const mempoolTxs = await getMempoolTransactions(address);
    for (const tx of mempoolTxs) {
      if (tx.amountSats >= PACK_PRICE_SATS) {
        const assigned = await isTxidAssigned(tx.txid);
        if (!assigned) {
          // FIFO: check if this order is the oldest pending
          const pending = await getPendingOrdersList();
          if (pending.length === 0 || pending[0] === orderId) {
            return { txid: tx.txid, amountSats: tx.amountSats };
          }
          // Not our turn — check if the oldest pending is still valid
          const oldest = await getOrderUnsafe(pending[0]);
          if (!oldest || oldest.status !== "pending") {
            // Stale entry, this order can claim
            return { txid: tx.txid, amountSats: tx.amountSats };
          }
        }
      }
    }

    // Check recently confirmed txs
    const confirmedTxs = await getConfirmedTransactions(address);
    for (const tx of confirmedTxs) {
      if (tx.amountSats >= PACK_PRICE_SATS) {
        const assigned = await isTxidAssigned(tx.txid);
        if (!assigned) {
          const pending = await getPendingOrdersList();
          if (pending.length === 0 || pending[0] === orderId) {
            return { txid: tx.txid, amountSats: tx.amountSats };
          }
          const oldest = await getOrderUnsafe(pending[0]);
          if (!oldest || oldest.status !== "pending") {
            return { txid: tx.txid, amountSats: tx.amountSats };
          }
        }
      }
    }
  } catch (e) {
    console.error("[pack/status] mempool scan error:", e);
  }

  return null;
}
