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
): AgentHandler {
  if (!config.features.l402) {
    return handler;
  }

  return createGatedHandler(handler, opts.amount ?? config.pricing.fortuneSingle);
}

/**
 * Create an L402-gated handler using MoneyDevKit.
 * Uses lazy dynamic import so the MDK dependency only loads when
 * L402 is actually enabled and the first request arrives.
 */
function createGatedHandler(handler: AgentHandler, amount: number): AgentHandler {
  let wrapped: AgentHandler | null = null;

  return async (req: Request): Promise<Response> => {
    if (!wrapped) {
      const { withPayment } = await import("@moneydevkit/nextjs/server");
      wrapped = withPayment({ amount, currency: "SAT" }, handler) as AgentHandler;
    }
    return wrapped(req);
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
