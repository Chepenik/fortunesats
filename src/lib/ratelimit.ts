import { Ratelimit } from "@upstash/ratelimit";
import { getRedis } from "@/lib/redis";

/**
 * Check rate limit for an API endpoint. Returns null if allowed,
 * or a 429 Response if the limit is exceeded.
 *
 * Falls back to allowing requests if Redis is unavailable
 * (rate limiting is defense-in-depth, not payment-critical).
 */
export async function checkRateLimit(
  req: Request,
  opts: { prefix: string; limit: number; window: `${number} s` | `${number} m` },
): Promise<Response | null> {
  const redis = getRedis();
  if (!redis) return null;

  try {
    const ratelimit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(opts.limit, opts.window),
      prefix: `rl:${opts.prefix}`,
    });

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      "unknown";

    const { success, reset } = await ratelimit.limit(ip);

    if (!success) {
      const retryAfter = Math.ceil((reset - Date.now()) / 1000);
      return Response.json(
        { error: { code: "rate_limited", message: "Too many requests. Please try again later." } },
        {
          status: 429,
          headers: { "Retry-After": String(Math.max(retryAfter, 1)) },
        },
      );
    }
  } catch {
    // Rate limiting is best-effort — allow request if Redis fails
  }

  return null;
}
