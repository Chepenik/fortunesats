/**
 * Health check endpoint.
 *
 * Called periodically by Vercel Cron. On Hobby plan this runs every 12h
 * (minimum allowed). On Pro plan, change schedule to every 5 min for true warm-keeping.
 *
 * Note: this does NOT warm the LDK node itself — that only happens when
 * /api/mdk receives an actual webhook. The value here is keeping the
 * Vercel compute instance warm so subsequent MDK requests avoid a
 * full container cold start.
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
