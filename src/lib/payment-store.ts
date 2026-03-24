/**
 * Check if MDK has received a payment for a given hash.
 * MDK stores payment state on globalThis using a well-known Symbol,
 * populated by the webhook handler when Lightning payments arrive.
 */

const MDK_PAYMENT_STATE_KEY = Symbol.for("mdk-checkout:payment-state");

interface MdkPaymentState {
  receivedPaymentHashes: Set<string>;
}

/** Hashes that have already been redeemed for a fortune. */
const consumedHashes = new Set<string>();

export function isPaid(paymentHash: string): boolean {
  const state = (globalThis as Record<symbol, MdkPaymentState | undefined>)[
    MDK_PAYMENT_STATE_KEY
  ];
  if (!state) return false;
  return state.receivedPaymentHashes.has(paymentHash);
}

/**
 * Atomically check payment and consume it. Returns true only once per hash,
 * preventing replay attacks where one payment yields unlimited fortunes.
 */
export function consumePayment(paymentHash: string): boolean {
  if (!isPaid(paymentHash)) return false;
  if (consumedHashes.has(paymentHash)) return false;
  consumedHashes.add(paymentHash);
  return true;
}
