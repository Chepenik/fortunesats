/**
 * Cloud-synced collections + streaks — Redis-backed.
 *
 * Redis keys:
 *   collection:{deviceId}  — JSON array of CollectedFortune[]
 *   streak:{deviceId}      — JSON StreakData
 *
 * Like leaderboard operations, collection/streak writes are non-critical:
 * failures are caught and swallowed so they never break payment flows.
 */

import { getRedis } from "@/lib/redis";
import type { CollectedFortune } from "@/lib/collection";
import type { StreakData } from "@/lib/streak";
import type { Rarity } from "@/lib/fortunes";

const COLLECTION_PREFIX = "collection:";
const STREAK_PREFIX = "streak:";
const DATA_TTL = 365 * 24 * 60 * 60; // 1 year, refreshed on write

/* ─── Collection Read/Write ──────────────────────────────── */

/** Fetch collection from Redis. Returns [] if unavailable. */
export async function getServerCollection(deviceId: string): Promise<CollectedFortune[]> {
  const redis = getRedis();
  if (!redis) return [];

  try {
    const data = await redis.get<CollectedFortune[]>(`${COLLECTION_PREFIX}${deviceId}`);
    return data ?? [];
  } catch (e) {
    console.error("[collection-sync:getServerCollection]", e);
    return [];
  }
}

/** Write full collection to Redis. */
export async function setServerCollection(
  deviceId: string,
  collection: CollectedFortune[],
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  try {
    await redis.set(`${COLLECTION_PREFIX}${deviceId}`, collection, { ex: DATA_TTL });
  } catch (e) {
    console.error("[collection-sync:setServerCollection]", e);
  }
}

/**
 * Add a single fortune to the server-side collection.
 * Called during fortune delivery — idempotent via text dedup.
 */
export async function addToServerCollection(
  deviceId: string,
  text: string,
  rarity: Rarity,
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  try {
    const key = `${COLLECTION_PREFIX}${deviceId}`;
    const existing = await redis.get<CollectedFortune[]>(key);
    const collection = existing ?? [];

    const entry = collection.find((f) => f.text === text);
    if (entry) {
      entry.pullCount += 1;
    } else {
      collection.unshift({
        text,
        rarity,
        firstPulled: new Date().toISOString(),
        pullCount: 1,
      });
    }

    await redis.set(key, collection, { ex: DATA_TTL });
  } catch (e) {
    console.error("[collection-sync:addToServerCollection]", e);
  }
}

/* ─── Streak Read/Write ──────────────────────────────────── */

const EMPTY_STREAK: StreakData = { current: 0, best: 0, total: 0, lastDate: null };

/** Fetch streak from Redis. Returns empty streak if unavailable. */
export async function getServerStreak(deviceId: string): Promise<StreakData> {
  const redis = getRedis();
  if (!redis) return { ...EMPTY_STREAK };

  try {
    const data = await redis.get<StreakData>(`${STREAK_PREFIX}${deviceId}`);
    return data ?? { ...EMPTY_STREAK };
  } catch (e) {
    console.error("[collection-sync:getServerStreak]", e);
    return { ...EMPTY_STREAK };
  }
}

/** Write streak to Redis. */
export async function setServerStreak(
  deviceId: string,
  streak: StreakData,
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  try {
    await redis.set(`${STREAK_PREFIX}${deviceId}`, streak, { ex: DATA_TTL });
  } catch (e) {
    console.error("[collection-sync:setServerStreak]", e);
  }
}

/**
 * Record a streak event server-side.
 * Same calendar-day semantics as the client-side recordFortune().
 */
export async function recordServerStreak(deviceId: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  try {
    const key = `${STREAK_PREFIX}${deviceId}`;
    const streak = await getServerStreak(deviceId);
    const t = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    if (streak.lastDate === t) {
      // Already pulled today — just bump total
      streak.total += 1;
    } else {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      const yesterday = y.toISOString().slice(0, 10);

      if (streak.lastDate === yesterday) {
        streak.current += 1;
      } else {
        streak.current = 1;
      }

      streak.total += 1;
      streak.lastDate = t;
      if (streak.current > streak.best) {
        streak.best = streak.current;
      }
    }

    await redis.set(key, streak, { ex: DATA_TTL });
  } catch (e) {
    console.error("[collection-sync:recordServerStreak]", e);
  }
}
