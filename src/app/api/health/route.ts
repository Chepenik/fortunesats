/**
 * Health check endpoint.
 *
 * Hit this before a demo to warm the serverless instance and
 * trigger MDK's LDK node sync (which takes 10-20s on cold start).
 *
 * Usage: curl https://fortunesats.vercel.app/api/health
 */
export async function GET() {
  return Response.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
}
