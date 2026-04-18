/**
 * Health check endpoint.
 *
 * Called periodically by Vercel Cron. Keeps the Vercel compute instance
 * warm so Strike checkout creation and webhook verification avoid a full
 * container cold start.
 *
 * Usage: curl https://fortunesats.com/api/health
 */
export async function GET(req: Request) {
  // Verify cron requests via CRON_SECRET (Vercel sends Authorization: Bearer <secret>)
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}` && req.headers.has("authorization")) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  return Response.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
}
