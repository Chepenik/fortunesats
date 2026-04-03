/**
 * Daily stats snapshot cron.
 *
 * Captures aggregate leaderboard metrics into a daily Redis snapshot
 * and prunes expired entries from the pending_orders list.
 *
 * Schedule: daily at midnight UTC (configured in vercel.json)
 */

import { captureDaily, prunePendingOrders } from "@/lib/stats";

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}` && req.headers.has("authorization")) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const snapshot = await captureDaily();
  const pruned = await prunePendingOrders();

  return Response.json({
    snapshot: snapshot
      ? {
          date: snapshot.timestamp.slice(0, 10),
          players: snapshot.players,
          fortunes: snapshot.fortunes,
          sats: snapshot.sats,
          legendaries: snapshot.legendaries,
          topStreak: snapshot.topStreak,
        }
      : null,
    pruned,
  });
}
