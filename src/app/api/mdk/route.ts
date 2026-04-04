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

/** Try to extract event context from the webhook body for logging. */
async function parseWebhookContext(
  req: Request,
): Promise<{ event?: string; nodeId?: string; amountMsat?: number; paymentHash?: string; clonedReq: Request }> {
  try {
    const body = await req.clone().json();
    return {
      event: body?.event ?? body?.type,
      nodeId: body?.nodeId ?? body?.node_id,
      amountMsat: body?.amountMsat ?? body?.amount_msat,
      paymentHash: body?.paymentHash ?? body?.payment_hash,
      clonedReq: req,
    };
  } catch {
    // Body isn't JSON or clone failed — proceed without context
    return { clonedReq: req };
  }
}

/** Categorize an MDK/LDK error for structured logging. */
function categorizeError(e: unknown): { category: string; retriable: boolean; detail: string } {
  const msg = e instanceof Error ? e.message : String(e);
  const code = (e as { code?: string })?.code;

  if (msg.includes("Failed to sync") || msg.includes("wallet operation")) {
    return { category: "sync_timeout", retriable: true, detail: "LDK wallet sync failed — likely cold-start timeout against VSS/chain backend" };
  }
  if (msg.includes("timeout") || msg.includes("ETIMEDOUT") || msg.includes("ECONNREFUSED")) {
    return { category: "network_timeout", retriable: true, detail: msg };
  }
  if (code === "GenericFailure") {
    return { category: "ldk_generic_failure", retriable: true, detail: msg };
  }
  return { category: "unknown", retriable: false, detail: msg };
}

export async function POST(req: Request) {
  const startMs = Date.now();

  // Extract event context from webhook body before MDK consumes it
  const ctx = await parseWebhookContext(req);
  const logPrefix = `[mdk:POST] [event=${ctx.event ?? "unknown"}]`;

  console.log(
    `${logPrefix} Webhook received`,
    ctx.nodeId ? `nodeId=${ctx.nodeId.slice(0, 12)}...` : "",
    ctx.paymentHash ? `paymentHash=${ctx.paymentHash.slice(0, 16)}...` : "",
    ctx.amountMsat != null ? `amountMsat=${ctx.amountMsat}` : "",
  );

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
    response = await mdkPost(ctx.clonedReq);
    const elapsedMs = Date.now() - startMs;
    console.log(`${logPrefix} MDK handler succeeded in ${elapsedMs}ms`);
  } catch (e) {
    mdkError = e;
    const elapsedMs = Date.now() - startMs;
    const { category, retriable, detail } = categorizeError(e);
    console.error(
      `${logPrefix} MDK handler FAILED after ${elapsedMs}ms`,
      JSON.stringify({ category, retriable, detail, code: (e as { code?: string })?.code }),
    );
    response = Response.json(
      {
        error: {
          code: "sync_failed",
          category,
          retriable,
          message: "Lightning node sync timed out. Payment may still be processing.",
        },
      },
      { status: 503, headers: { "Retry-After": "5" } },
    );
  }

  // After MDK finishes (or fails), diff the globalThis set and sync new hashes to Redis.
  // Payment hashes may have been recorded before the sync timeout.
  const stateAfter = (
    globalThis as Record<symbol, { receivedPaymentHashes: Set<string> } | undefined>
  )[MDK_PAYMENT_STATE_KEY];

  if (stateAfter) {
    const newHashes: string[] = [];
    const writes: Promise<void>[] = [];
    for (const hash of stateAfter.receivedPaymentHashes) {
      if (!before.has(hash) && !syncedHashes.has(hash)) {
        if (syncedHashes.size >= MAX_SYNCED) syncedHashes.clear();
        syncedHashes.add(hash);
        newHashes.push(hash);
        writes.push(markPaidInRedis(hash));
      }
    }
    if (writes.length > 0) {
      const results = await Promise.allSettled(writes);
      const failed = results.filter((r) => r.status === "rejected").length;
      console.log(
        `${logPrefix} Payment hash sync: ${writes.length} new, ${failed} failed to write to Redis`,
        mdkError ? "(recovered despite sync failure)" : "",
        newHashes.map((h) => h.slice(0, 16) + "..."),
      );
    } else if (mdkError) {
      console.warn(`${logPrefix} Sync failed and no new payment hashes recovered from globalThis`);
    }
  } else if (mdkError) {
    console.warn(`${logPrefix} Sync failed and no MDK payment state found in globalThis`);
  }

  const totalMs = Date.now() - startMs;
  if (totalMs > 10_000) {
    console.warn(`${logPrefix} Slow webhook: total handler time ${totalMs}ms`);
  }

  return response;
}

// Give MDK's LDK node time to build + sync (takes ~10-20s on cold start)
export const maxDuration = 60;
