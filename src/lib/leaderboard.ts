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
 * @param displayName — caller resolves this once via resolveDisplayNameFromReq()
 * @param sats — pass 0 for pack reveals (sats already tracked at payment time)
 */
export async function recordFortuneReveal(
  deviceId: string,
  displayName: string,
  rarity: Rarity,
  sats: number,
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  try {
    const deviceKey = `${DEVICE_PREFIX}${deviceId}`;
    const now = new Date();

    // Read current streak metadata (2 fields instead of 3 — displayName comes from caller)
    const meta = await redis.hmget<{
      lastFortuneAt: string | null;
      currentStreak: string | null;
    }>(deviceKey, "lastFortuneAt", "currentStreak");

    let newStreak = 1;
    if (meta?.lastFortuneAt) {
      const elapsed = now.getTime() - new Date(meta.lastFortuneAt).getTime();
      if (elapsed <= STREAK_WINDOW_MS) {
        newStreak = (parseInt(meta?.currentStreak || "0", 10) || 0) + 1;
      }
    }

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
  } catch (e) {
    console.error("[leaderboard:recordFortuneReveal]", e);
  }
}

/**
 * Record sats spent at pack payment confirmation time.
 * Fortune count is tracked separately at reveal time.
 *
 * @param displayName — caller resolves this once via resolveDisplayNameFromReq()
 */
export async function recordSatsSpent(
  deviceId: string,
  displayName: string,
  sats: number,
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  try {
    const deviceKey = `${DEVICE_PREFIX}${deviceId}`;
    const pipe = redis.pipeline();
    pipe.zincrby(LB_SATS, sats, deviceId);
    pipe.hset(deviceKey, { displayName });
    await pipe.exec();
  } catch (e) {
    console.error("[leaderboard:recordSatsSpent]", e);
  }
}

/**
 * Update display name in the device hash (called when user sets initials).
 * Single HSET — 1 Redis command.
 */
export async function updateLeaderboardDisplayName(
  deviceId: string,
  displayName: string,
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  try {
    await redis.hset(`${DEVICE_PREFIX}${deviceId}`, { displayName });
  } catch (e) {
    console.error("[leaderboard:updateDisplayName]", e);
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
    // Single pipeline: 4 ZRANGE + (optionally) 9 "you" commands
    // Reduces Upstash HTTP requests from 5-6 to 2 (this + display name batch)
    const mainPipe = redis.pipeline();
    mainPipe.zrange(LB_FORTUNES, 0, limit - 1, { rev: true, withScores: true });   // [0]
    mainPipe.zrange(LB_SATS, 0, limit - 1, { rev: true, withScores: true });       // [1]
    mainPipe.zrange(LB_LEGENDARY, 0, limit - 1, { rev: true, withScores: true });  // [2]
    mainPipe.zrange(LB_STREAK, 0, limit - 1, { rev: true, withScores: true });     // [3]
    if (deviceId) {
      mainPipe.zrevrank(LB_FORTUNES, deviceId);                          // [4]
      mainPipe.zscore(LB_FORTUNES, deviceId);                            // [5]
      mainPipe.zrevrank(LB_SATS, deviceId);                              // [6]
      mainPipe.zscore(LB_SATS, deviceId);                                // [7]
      mainPipe.zrevrank(LB_LEGENDARY, deviceId);                         // [8]
      mainPipe.zscore(LB_LEGENDARY, deviceId);                           // [9]
      mainPipe.zrevrank(LB_STREAK, deviceId);                            // [10]
      mainPipe.zscore(LB_STREAK, deviceId);                              // [11]
      mainPipe.hget(`${DEVICE_PREFIX}${deviceId}`, "displayName");       // [12]
    }
    const raw = await mainPipe.exec();

    // Parse withScores results: [member, score, member, score, ...]
    type ScoredEntry = { member: string; score: number };
    function parseScoredResults(data: unknown): ScoredEntry[] {
      if (!Array.isArray(data)) return [];
      const entries: ScoredEntry[] = [];
      for (let i = 0; i < data.length; i += 2) {
        entries.push({ member: String(data[i]), score: Number(data[i + 1]) || 0 });
      }
      return entries;
    }

    const fortuneEntries = parseScoredResults(raw[0]);
    const satEntries = parseScoredResults(raw[1]);
    const legendaryEntries = parseScoredResults(raw[2]);
    const streakEntries = parseScoredResults(raw[3]);

    // Collect unique device IDs to batch-fetch display names
    const allIds = new Set<string>();
    for (const e of [...fortuneEntries, ...satEntries, ...legendaryEntries, ...streakEntries]) {
      allIds.add(e.member);
    }

    // Batch fetch display names (single pipeline — 2nd and final HTTP request)
    const nameMap = new Map<string, string>();
    if (allIds.size > 0) {
      const namePipe = redis.pipeline();
      for (const id of allIds) {
        namePipe.hget(`${DEVICE_PREFIX}${id}`, "displayName");
      }
      const results = await namePipe.exec();
      const ids = [...allIds];
      for (let i = 0; i < ids.length; i++) {
        nameMap.set(ids[i], (results[i] as string) || getDisplayName(ids[i]));
      }
    }

    // Build LeaderboardEntry arrays
    function toEntries(scored: ScoredEntry[]): LeaderboardEntry[] {
      return scored.map((e, i) => ({
        rank: i + 1,
        displayName: nameMap.get(e.member) || getDisplayName(e.member),
        score: e.score,
        isYou: e.member === deviceId,
      }));
    }

    const fortunes = toEntries(fortuneEntries);
    const sats = toEntries(satEntries);
    const legendary = toEntries(legendaryEntries);
    const streak = toEntries(streakEntries);

    // Extract caller's rank from the same pipeline results
    let you: YouData | null = null;
    if (deviceId) {
      const hasAny = raw[4] !== null || raw[6] !== null || raw[8] !== null || raw[10] !== null;
      if (hasAny) {
        you = {
          displayName: (raw[12] as string) || getDisplayName(deviceId),
          fortunes: raw[4] !== null ? { rank: (raw[4] as number) + 1, score: Number(raw[5]) || 0 } : null,
          sats: raw[6] !== null ? { rank: (raw[6] as number) + 1, score: Number(raw[7]) || 0 } : null,
          legendary: raw[8] !== null ? { rank: (raw[8] as number) + 1, score: Number(raw[9]) || 0 } : null,
          streak: raw[10] !== null ? { rank: (raw[10] as number) + 1, score: Number(raw[11]) || 0 } : null,
        };
      }
    }

    return { fortunes, sats, legendary, streak, you };
  } catch (e) {
    console.error("[leaderboard:getLeaderboard]", e);
    return empty;
  }
}
