import { POST as mdkPost } from "@moneydevkit/nextjs/server/route";
import { markPaidInRedis } from "@/lib/payment-store";

const MDK_PAYMENT_STATE_KEY = Symbol.for("mdk-checkout:payment-state");

/**
 * Set of hashes we've already synced to Redis on this instance,
 * so we don't re-write them on every webhook call.
 * Capped to prevent unbounded growth on warm Fluid Compute instances.
 */
const MAX_SYNCED = 500;
const syncedHashes = new Set<string>();

export async function POST(req: Request) {
  // Snapshot hashes before MDK processes
  const stateBefore = (
    globalThis as Record<symbol, { receivedPaymentHashes: Set<string> } | undefined>
  )[MDK_PAYMENT_STATE_KEY];
  const before = stateBefore
    ? new Set(stateBefore.receivedPaymentHashes)
    : new Set<string>();

  // Let MDK handle the webhook (starts LDK node, processes payments).
  // Sync timeout is hardcoded at 10s in the native binary — catch failures
  // so we can still extract any payment hashes that were recorded before the crash.
  let response: Response;
  let mdkError: unknown = null;
  try {
    response = await mdkPost(req);
  } catch (e) {
    mdkError = e;
    console.error("[mdk:POST] MDK handler failed (likely sync timeout):", e);
    response = Response.json(
      { error: { code: "sync_failed", message: "Lightning node sync timed out. Payment may still be processing." } },
      { status: 503, headers: { "Retry-After": "5" } },
    );
  }

  // After MDK finishes (or fails), diff the globalThis set and sync new hashes to Redis.
  // Payment hashes may have been recorded before the sync timeout.
  const stateAfter = (
    globalThis as Record<symbol, { receivedPaymentHashes: Set<string> } | undefined>
  )[MDK_PAYMENT_STATE_KEY];

  if (stateAfter) {
    const writes: Promise<void>[] = [];
    for (const hash of stateAfter.receivedPaymentHashes) {
      if (!before.has(hash) && !syncedHashes.has(hash)) {
        if (syncedHashes.size >= MAX_SYNCED) syncedHashes.clear();
        syncedHashes.add(hash);
        writes.push(markPaidInRedis(hash));
      }
    }
    if (writes.length > 0) {
      await Promise.allSettled(writes);
      if (mdkError) {
        console.log(`[mdk:POST] Recovered ${writes.length} payment hash(es) despite sync failure`);
      }
    }
  }

  return response;
}

// Give MDK's LDK node time to build + sync (takes ~10-20s on cold start)
export const maxDuration = 60;
