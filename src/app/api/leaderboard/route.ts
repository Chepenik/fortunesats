import { getDeviceId } from "@/lib/device-id";
import { getLeaderboard } from "@/lib/leaderboard";
import { checkRateLimit } from "@/lib/ratelimit";

export async function GET(req: Request) {
  const limited = await checkRateLimit(req, { prefix: "leaderboard", limit: 10, window: "1 m" });
  if (limited) return limited;

  const deviceId = getDeviceId(req);
  const data = await getLeaderboard(deviceId);

  return Response.json(data, {
    headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" },
  });
}
