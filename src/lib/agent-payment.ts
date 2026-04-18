/**
 * Agent-facing payment wrapper.
 *
 * Agent endpoints are currently free — `withAgentPayment` is a pass-through.
 * If agent billing comes back later, wire it through Strike here.
 */

export type AgentHandler = (req: Request) => Promise<Response>;

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
