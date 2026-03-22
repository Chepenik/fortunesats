/**
 * Check if MDK has received a payment for a given hash.
 * MDK stores payment state on globalThis using a well-known Symbol,
 * populated by the webhook handler when Lightning payments arrive.
 */

const MDK_PAYMENT_STATE_KEY = Symbol.for("mdk-checkout:payment-state");

interface MdkPaymentState {
  receivedPaymentHashes: Set<string>;
}

export function isPaid(paymentHash: string): boolean {
  const state = (globalThis as Record<symbol, MdkPaymentState | undefined>)[
    MDK_PAYMENT_STATE_KEY
  ];
  if (!state) return false;
  return state.receivedPaymentHashes.has(paymentHash);
}
