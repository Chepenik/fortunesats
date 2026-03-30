import { getRecentActivity } from "@/lib/activity";
import { checkRateLimit } from "@/lib/ratelimit";

export async function GET(req: Request) {
  const limited = await checkRateLimit(req, { prefix: "activity", limit: 20, window: "1 m" });
  if (limited) return limited;

  const events = await getRecentActivity(10);

  return Response.json({ events }, {
    headers: { "Cache-Control": "public, s-maxage=10, stale-while-revalidate=20" },
  });
}
