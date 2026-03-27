import { POST as mdkPost } from "@moneydevkit/nextjs/server/route";
import { markPaidInRedis } from "@/lib/payment-store";

const MDK_PAYMENT_STATE_KEY = Symbol.for("mdk-checkout:payment-state");

/**
 * Set of hashes we've already synced to Redis on this instance,
 * so we don't re-write them on every webhook call.
 */
const syncedHashes = new Set<string>();

export async function POST(req: Request) {
  // Snapshot hashes before MDK processes
  const stateBefore = (
    globalThis as Record<symbol, { receivedPaymentHashes: Set<string> } | undefined>
  )[MDK_PAYMENT_STATE_KEY];
  const before = stateBefore
    ? new Set(stateBefore.receivedPaymentHashes)
    : new Set<string>();

  // Let MDK handle the webhook (starts LDK node, processes payments)
  const response = await mdkPost(req);

  // After MDK finishes, diff the globalThis set and sync new hashes to Redis
  const stateAfter = (
    globalThis as Record<symbol, { receivedPaymentHashes: Set<string> } | undefined>
  )[MDK_PAYMENT_STATE_KEY];

  if (stateAfter) {
    const writes: Promise<void>[] = [];
    for (const hash of stateAfter.receivedPaymentHashes) {
      if (!before.has(hash) && !syncedHashes.has(hash)) {
        syncedHashes.add(hash);
        writes.push(markPaidInRedis(hash));
      }
    }
    if (writes.length > 0) {
      await Promise.allSettled(writes);
    }
  }

  return response;
}

// Give MDK's LDK node time to build + sync (takes ~10-20s on cold start)
export const maxDuration = 60;
