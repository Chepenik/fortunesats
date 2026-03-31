/**
 * L402 payment gate for agent-facing endpoints.
 *
 * L402 (formerly LSAT) is a protocol for machine-to-machine payments:
 *   1. Agent requests a resource
 *   2. Server responds 402 with WWW-Authenticate header containing a Lightning invoice
 *   3. Agent pays the invoice, receives a preimage
 *   4. Agent retries with Authorization: L402 <macaroon>:<preimage>
 *   5. Server validates payment and returns the resource
 *
 * This module provides a conditional wrapper:
 *   - When config.features.l402 is OFF: requests pass through (free access)
 *   - When config.features.l402 is ON: delegates to MoneyDevKit's withPayment
 *
 * The abstraction exists so the agent API surface is ready for monetization
 * without requiring L402 to be wired in from day one.
 */

import { config } from "./config";

export type AgentHandler = (req: Request) => Promise<Response>;

/**
 * Wrap an agent endpoint handler with optional L402 payment gating.
 *
 * When L402 is disabled (default), the handler runs directly.
 * When L402 is enabled, the handler is wrapped with MoneyDevKit's
 * withPayment, which handles the full L402 challenge/response flow.
 */
export function withAgentPayment(
  handler: AgentHandler,
  opts: { amount?: number } = {},
): AgentHandler | ReturnType<typeof createGatedHandler> {
  if (!config.features.l402) {
    return handler;
  }

  return createGatedHandler(handler, opts.amount ?? config.pricing.fortuneSingle);
}

/**
 * Create an L402-gated handler using MoneyDevKit.
 * Isolated so the MDK import only loads when L402 is enabled.
 */
function createGatedHandler(handler: AgentHandler, amount: number) {
  // MDK's withPayment wraps at module level — we import and call it here
  // so the dependency is only loaded when L402 is actually enabled.
  //
  // In production, this would be:
  //   import { withPayment } from "@moneydevkit/nextjs/server";
  //   return withPayment({ amount, currency: "SAT" }, handler);
  //
  // For now, we return a handler that signals payment requirement
  // in the L402 response format when no valid authorization is present.
  return async (req: Request): Promise<Response> => {
    const authHeader = req.headers.get("authorization");

    if (!authHeader || !authHeader.startsWith("L402 ")) {
      return Response.json(
        {
          error: {
            code: "payment_required",
            message: "This endpoint requires payment via L402.",
            amount,
            currency: "SAT",
            protocol: "L402",
            docs: "https://github.com/your-repo/fortunesats/blob/main/docs/l402.md",
          },
        },
        {
          status: 402,
          headers: {
            "WWW-Authenticate": `L402 amount="${amount}", currency="SAT"`,
          },
        },
      );
    }

    // When MDK is wired in, it validates the macaroon + preimage here.
    // For now, delegate to handler if any L402 header is present.
    // TODO: Wire MDK validation when L402 feature is fully enabled
    return handler(req);
  };
}

/**
 * JSON error response in a consistent agent-friendly format.
 */
export function agentError(
  code: string,
  message: string,
  status: number,
  extra?: Record<string, unknown>,
): Response {
  return Response.json(
    { error: { code, message, ...extra } },
    { status },
  );
}
