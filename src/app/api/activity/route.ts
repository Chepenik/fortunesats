import { getRecentActivity } from "@/lib/activity";
import { checkRateLimit } from "@/lib/ratelimit";
import { getFlags } from "@/lib/flags";

export async function GET(req: Request) {
  const { activityFeedEnabled } = getFlags();
  if (!activityFeedEnabled) {
    return Response.json({ events: [] }, {
      headers: { "Cache-Control": "public, s-maxage=10, stale-while-revalidate=20" },
    });
  }

  const limited = await checkRateLimit(req, { prefix: "activity", limit: 10, window: "1 m" });
  if (limited) return limited;

  const events = await getRecentActivity(10);

  return Response.json({ events }, {
    headers: { "Cache-Control": "public, s-maxage=10, stale-while-revalidate=20" },
  });
}
