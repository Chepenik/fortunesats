/**
 * Agent-facing payment wrapper.
 *
 * Strike-only as of 2026-04-17: this module no longer gates agent
 * endpoints behind L402. `withAgentPayment` is now a pass-through so the
 * agent API remains free, consistent with the decision to issue Strike
 * invoices only for fortune, gift, and pack flows.
 *
 * The MDK-backed L402 implementation is preserved below in a block
 * comment for future reference.
 */

export type AgentHandler = (req: Request) => Promise<Response>;

/**
 * Pass-through — agent endpoints always run. Retained as a function
 * (rather than inlining) so callers don't need to change if L402 comes
 * back later.
 */
export function withAgentPayment(
  handler: AgentHandler,
  _opts: { amount?: number } = {},
): AgentHandler {
  void _opts;
  return handler;
}

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

/* =========================================================================
 * MDK / L402 (archived — Strike-only as of 2026-04-17)
 * To restore: uncomment the original implementation below, re-add the
 * `config.features.l402` branch in withAgentPayment, and ensure
 * `@moneydevkit/nextjs` is installed.
 * =========================================================================
 *
 * import { config } from "./config";
 *
 * export function withAgentPayment(
 *   handler: AgentHandler,
 *   opts: { amount?: number } = {},
 * ): AgentHandler {
 *   if (!config.features.l402) {
 *     return handler;
 *   }
 *   return createGatedHandler(handler, opts.amount ?? config.pricing.fortuneSingle);
 * }
 *
 * function createGatedHandler(handler: AgentHandler, amount: number): AgentHandler {
 *   let wrapped: AgentHandler | null = null;
 *   return async (req: Request): Promise<Response> => {
 *     if (!wrapped) {
 *       const { withPayment } = await import("@moneydevkit/nextjs/server");
 *       wrapped = withPayment({ amount, currency: "SAT" }, handler) as AgentHandler;
 *     }
 *     return wrapped(req);
 *   };
 * }
 */
