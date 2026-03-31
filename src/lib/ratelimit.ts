import { Ratelimit } from "@upstash/ratelimit";
import { getRedis } from "@/lib/redis";

/**
 * Cached Ratelimit instances per prefix.
 *
 * Creating new instances per request wastes the ephemeralCache (in-memory
 * LRU that skips Redis when the answer is already known). With Fluid
 * Compute / warm serverless instances, reusing the instance lets the
 * cache persist across requests, dramatically reducing Redis commands.
 */
const instances = new Map<string, Ratelimit>();

function getRatelimit(prefix: string, limit: number, window: `${number} s` | `${number} m`): Ratelimit | null {
  const redis = getRedis();
  if (!redis) return null;

  const key = `${prefix}:${limit}:${window}`;
  let rl = instances.get(key);
  if (!rl) {
    rl = new Ratelimit({
      redis,
      // fixedWindow uses 1-2 Redis commands per check (INCRBY + PEXPIRE).
      // slidingWindow used 3-5 — this alone cuts rate-limit costs 60-75%.
      limiter: Ratelimit.fixedWindow(limit, window),
      prefix: `rl:${prefix}`,
      // In-memory LRU cache: when the same IP hits again within the window,
      // the limiter serves the answer from memory without touching Redis.
      ephemeralCache: new Map(),
    });
    instances.set(key, rl);
  }
  return rl;
}

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
  const ratelimit = getRatelimit(opts.prefix, opts.limit, opts.window);
  if (!ratelimit) return null;

  try {
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
  } catch (e) {
    console.error("[ratelimit:checkRateLimit]", e);
    // Rate limiting is best-effort — allow request if Redis fails
  }

  return null;
}
