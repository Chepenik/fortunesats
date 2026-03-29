/**
 * Redis-backed global leaderboard using sorted sets.
 *
 * Redis keys:
 *   lb:fortunes      — sorted set, score = total fortunes revealed
 *   lb:sats          — sorted set, score = total sats spent
 *   lb:legendary     — sorted set, score = legendary fortune count
 *   lb:streak        — sorted set, score = current consecutive streak
 *   lb:device:{id}   — hash, { displayName, currentStreak, lastFortuneAt }
 *
 * All leaderboard operations are non-critical: failures are caught
 * and swallowed so they never break the payment/fortune flows.
 */

import { getRedis } from "@/lib/redis";
import { getDisplayName } from "@/lib/device-id";
import type { Rarity } from "@/lib/fortunes";

const LB_FORTUNES = "lb:fortunes";
const LB_SATS = "lb:sats";
const LB_LEGENDARY = "lb:legendary";
const LB_STREAK = "lb:streak";
const DEVICE_PREFIX = "lb:device:";

const STREAK_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

/* ─── Write operations ──────────────────────────────────── */

/**
 * Record a fortune reveal for leaderboard tracking.
 * Called ONLY after verified paid fortune delivery.
 *
 * @param sats — pass 0 for pack reveals (sats already tracked at payment time)
 */
export async function recordFortuneReveal(
  deviceId: string,
  rarity: Rarity,
  sats: number,
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  try {
    const deviceKey = `${DEVICE_PREFIX}${deviceId}`;
    const now = new Date();

    // Read current streak metadata
    const meta = await redis.hmget<{
      lastFortuneAt: string | null;
      currentStreak: string | null;
      displayName: string | null;
    }>(deviceKey, "lastFortuneAt", "currentStreak", "displayName");

    let newStreak = 1;
    if (meta?.lastFortuneAt) {
      const elapsed = now.getTime() - new Date(meta.lastFortuneAt).getTime();
      if (elapsed <= STREAK_WINDOW_MS) {
        newStreak = (parseInt(meta?.currentStreak || "0", 10) || 0) + 1;
      }
    }

    const displayName = meta?.displayName || getDisplayName(deviceId);

    const pipe = redis.pipeline();
    pipe.zincrby(LB_FORTUNES, 1, deviceId);
    if (sats > 0) pipe.zincrby(LB_SATS, sats, deviceId);
    if (rarity === "legendary") pipe.zincrby(LB_LEGENDARY, 1, deviceId);
    pipe.zadd(LB_STREAK, { score: newStreak, member: deviceId });
    pipe.hset(deviceKey, {
      displayName,
      currentStreak: String(newStreak),
      lastFortuneAt: now.toISOString(),
    });
    await pipe.exec();
  } catch {
    // Non-critical — never break the fortune flow
  }
}

/**
 * Record sats spent at pack payment confirmation time.
 * Fortune count is tracked separately at reveal time.
 */
export async function recordSatsSpent(
  deviceId: string,
  sats: number,
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  try {
    const deviceKey = `${DEVICE_PREFIX}${deviceId}`;
    const pipe = redis.pipeline();
    pipe.zincrby(LB_SATS, sats, deviceId);
    // Ensure display name exists
    pipe.hsetnx(deviceKey, "displayName", getDisplayName(deviceId));
    await pipe.exec();
  } catch {
    // Non-critical
  }
}

/* ─── Read operations ───────────────────────────────────── */

export interface LeaderboardEntry {
  rank: number;
  displayName: string;
  score: number;
  isYou: boolean;
}

export interface YouData {
  displayName: string;
  fortunes: { rank: number; score: number } | null;
  sats: { rank: number; score: number } | null;
  legendary: { rank: number; score: number } | null;
  streak: { rank: number; score: number } | null;
}

export interface LeaderboardData {
  fortunes: LeaderboardEntry[];
  sats: LeaderboardEntry[];
  legendary: LeaderboardEntry[];
  streak: LeaderboardEntry[];
  you: YouData | null;
}

/**
 * Fetch top N entries for each dimension + the caller's rank.
 */
export async function getLeaderboard(
  deviceId: string | null,
  limit: number = 10,
): Promise<LeaderboardData> {
  const empty: LeaderboardData = {
    fortunes: [], sats: [], legendary: [], streak: [], you: null,
  };

  const redis = getRedis();
  if (!redis) return empty;

  try {
    // Fetch top entries for each dimension
    const [fortuneIds, satIds, legendaryIds, streakIds] = await Promise.all([
      redis.zrange(LB_FORTUNES, 0, limit - 1, { rev: true }) as Promise<string[]>,
      redis.zrange(LB_SATS, 0, limit - 1, { rev: true }) as Promise<string[]>,
      redis.zrange(LB_LEGENDARY, 0, limit - 1, { rev: true }) as Promise<string[]>,
      redis.zrange(LB_STREAK, 0, limit - 1, { rev: true }) as Promise<string[]>,
    ]);

    // Collect unique device IDs to batch-fetch display names and scores
    const allIds = new Set<string>([
      ...fortuneIds, ...satIds, ...legendaryIds, ...streakIds,
    ]);

    // Batch fetch display names
    const nameMap = new Map<string, string>();
    if (allIds.size > 0) {
      const pipe = redis.pipeline();
      for (const id of allIds) {
        pipe.hget(`${DEVICE_PREFIX}${id}`, "displayName");
      }
      const results = await pipe.exec();
      const ids = [...allIds];
      for (let i = 0; i < ids.length; i++) {
        nameMap.set(ids[i], (results[i] as string) || getDisplayName(ids[i]));
      }
    }

    // Fetch scores for each leaderboard's top entries
    async function buildEntries(key: string, ids: string[]): Promise<LeaderboardEntry[]> {
      if (ids.length === 0) return [];
      const pipe = redis!.pipeline();
      for (const id of ids) pipe.zscore(key, id);
      const scores = await pipe.exec();
      return ids.map((id, i) => ({
        rank: i + 1,
        displayName: nameMap.get(id) || getDisplayName(id),
        score: Number(scores[i]) || 0,
        isYou: id === deviceId,
      }));
    }

    const [fortunes, sats, legendary, streak] = await Promise.all([
      buildEntries(LB_FORTUNES, fortuneIds),
      buildEntries(LB_SATS, satIds),
      buildEntries(LB_LEGENDARY, legendaryIds),
      buildEntries(LB_STREAK, streakIds),
    ]);

    // Fetch caller's rank in each dimension
    let you: YouData | null = null;
    if (deviceId) {
      const pipe = redis.pipeline();
      pipe.zrevrank(LB_FORTUNES, deviceId);
      pipe.zscore(LB_FORTUNES, deviceId);
      pipe.zrevrank(LB_SATS, deviceId);
      pipe.zscore(LB_SATS, deviceId);
      pipe.zrevrank(LB_LEGENDARY, deviceId);
      pipe.zscore(LB_LEGENDARY, deviceId);
      pipe.zrevrank(LB_STREAK, deviceId);
      pipe.zscore(LB_STREAK, deviceId);
      pipe.hget(`${DEVICE_PREFIX}${deviceId}`, "displayName");
      const r = await pipe.exec();

      const hasAny = r[0] !== null || r[2] !== null || r[4] !== null || r[6] !== null;
      if (hasAny) {
        you = {
          displayName: (r[8] as string) || getDisplayName(deviceId),
          fortunes: r[0] !== null ? { rank: (r[0] as number) + 1, score: Number(r[1]) || 0 } : null,
          sats: r[2] !== null ? { rank: (r[2] as number) + 1, score: Number(r[3]) || 0 } : null,
          legendary: r[4] !== null ? { rank: (r[4] as number) + 1, score: Number(r[5]) || 0 } : null,
          streak: r[6] !== null ? { rank: (r[6] as number) + 1, score: Number(r[7]) || 0 } : null,
        };
      }
    }

    return { fortunes, sats, legendary, streak, you };
  } catch {
    return empty;
  }
}
