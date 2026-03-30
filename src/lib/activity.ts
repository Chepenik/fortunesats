/**
 * Recent activity feed backed by a bounded Redis list.
 *
 * Redis key:
 *   activity:recent — list of JSON-encoded events (newest first)
 *
 * Like leaderboard operations, activity writes are non-critical:
 * failures are caught and swallowed so they never break payment flows.
 */

import { getRedis } from "@/lib/redis";
import { getDisplayName } from "@/lib/device-id";
import type { Rarity } from "@/lib/fortunes";

const ACTIVITY_KEY = "activity:recent";
const MAX_EVENTS = 30;

/** Compact event shape stored in Redis. */
interface StoredEvent {
  /** displayName (pseudonym) */
  d: string;
  /** rarity */
  r: Rarity;
  /** unix timestamp in ms */
  t: number;
}

/** Public event shape returned by the API. */
export interface ActivityEvent {
  displayName: string;
  rarity: Rarity;
  timestamp: number;
}

/* ─── Write ────────────────────────────────────────────── */

/**
 * Record a fortune reveal in the activity feed.
 * Called after verified fortune delivery — same call sites as recordFortuneReveal.
 */
export async function recordActivity(
  deviceId: string,
  rarity: Rarity,
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  try {
    const event: StoredEvent = {
      d: getDisplayName(deviceId),
      r: rarity,
      t: Date.now(),
    };
    const pipe = redis.pipeline();
    pipe.lpush(ACTIVITY_KEY, JSON.stringify(event));
    pipe.ltrim(ACTIVITY_KEY, 0, MAX_EVENTS - 1);
    await pipe.exec();
  } catch {
    // Non-critical — never break the fortune flow
  }
}

/* ─── Read ─────────────────────────────────────────────── */

/**
 * Fetch the most recent activity events.
 */
export async function getRecentActivity(
  limit: number = 10,
): Promise<ActivityEvent[]> {
  const redis = getRedis();
  if (!redis) return [];

  try {
    const raw = await redis.lrange(ACTIVITY_KEY, 0, limit - 1);
    return raw.map((item) => {
      const parsed: StoredEvent =
        typeof item === "string" ? JSON.parse(item) : (item as StoredEvent);
      return {
        displayName: parsed.d,
        rarity: parsed.r,
        timestamp: parsed.t,
      };
    });
  } catch {
    return [];
  }
}
