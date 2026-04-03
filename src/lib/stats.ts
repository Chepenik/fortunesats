/**
 * Daily stats snapshots and pending-order pruning.
 *
 * Redis keys:
 *   stats:daily:YYYY-MM-DD — hash with aggregate metrics for that day
 *
 * All operations are non-critical: failures are caught and logged.
 */

import { getRedis } from "@/lib/redis";

const LB_FORTUNES = "lb:fortunes";
const LB_SATS = "lb:sats";
const LB_LEGENDARY = "lb:legendary";
const LB_STREAK = "lb:streak";

const STATS_TTL_SECONDS = 365 * 24 * 60 * 60; // 1 year

export interface DailySnapshot {
  players: number;
  fortunes: number;
  sats: number;
  legendaries: number;
  topStreak: number;
  timestamp: string;
}

/**
 * Sum all scores in a sorted set by reading every member with ZRANGE WITHSCORES.
 */
async function sumSortedSet(
  redis: NonNullable<ReturnType<typeof getRedis>>,
  key: string,
): Promise<{ count: number; total: number }> {
  const raw = await redis.zrange(key, 0, -1, { withScores: true });
  // raw is [member, score, member, score, ...]
  let total = 0;
  let count = 0;
  if (Array.isArray(raw)) {
    for (let i = 1; i < raw.length; i += 2) {
      total += Number(raw[i]) || 0;
      count++;
    }
  }
  return { count, total };
}

/**
 * Capture a daily metrics snapshot and store it in Redis.
 * Returns the snapshot on success, null on failure or missing Redis.
 */
export async function captureDaily(): Promise<DailySnapshot | null> {
  const redis = getRedis();
  if (!redis) return null;

  try {
    const [fortunes, sats, legendaries] = await Promise.all([
      sumSortedSet(redis, LB_FORTUNES),
      sumSortedSet(redis, LB_SATS),
      sumSortedSet(redis, LB_LEGENDARY),
    ]);

    // Top streak: highest score in lb:streak
    const topRaw = await redis.zrange(LB_STREAK, 0, 0, {
      rev: true,
      withScores: true,
    });
    const topStreak =
      Array.isArray(topRaw) && topRaw.length >= 2
        ? Number(topRaw[1]) || 0
        : 0;

    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const snapshot: DailySnapshot = {
      players: fortunes.count,
      fortunes: fortunes.total,
      sats: sats.total,
      legendaries: legendaries.total,
      topStreak,
      timestamp: new Date().toISOString(),
    };

    await redis.set(`stats:daily:${today}`, JSON.stringify(snapshot), {
      ex: STATS_TTL_SECONDS,
    });

    return snapshot;
  } catch (e) {
    console.error("[stats:captureDaily]", e);
    return null;
  }
}

/**
 * Remove pending order IDs whose order keys have expired.
 * Returns the number of pruned entries.
 */
export async function prunePendingOrders(): Promise<number> {
  const redis = getRedis();
  if (!redis) return 0;

  try {
    const ids = (await redis.lrange("pending_orders", 0, -1)) as string[];
    if (ids.length === 0) return 0;

    // Check which order keys still exist
    const pipe = redis.pipeline();
    for (const id of ids) {
      pipe.exists(`order:${id}`);
    }
    const results = await pipe.exec();

    // Remove IDs whose order key is gone
    let pruned = 0;
    for (let i = 0; i < ids.length; i++) {
      if (results[i] === 0) {
        await redis.lrem("pending_orders", 0, ids[i]);
        pruned++;
      }
    }

    if (pruned > 0) {
      console.log(`[stats:prunePendingOrders] Pruned ${pruned} expired order(s)`);
    }

    return pruned;
  } catch (e) {
    console.error("[stats:prunePendingOrders]", e);
    return 0;
  }
}

/**
 * Read a single day's snapshot.
 */
export async function getDailyStats(
  date: string,
): Promise<DailySnapshot | null> {
  const redis = getRedis();
  if (!redis) return null;

  try {
    const raw = await redis.get<string>(`stats:daily:${date}`);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.error("[stats:getDailyStats]", e);
    return null;
  }
}
