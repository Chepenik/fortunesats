/**
 * Fortune streak tracking — localStorage-backed, device-local.
 *
 * Tracks consecutive days a user has purchased a fortune.
 * Streaks reset if a calendar day is skipped.
 * All state lives in the browser — intentionally lightweight and fun.
 */

const STORAGE_KEY = "fortunesats:streak";

export interface StreakData {
  /** Current consecutive-day streak */
  current: number;
  /** Longest streak ever achieved on this device */
  best: number;
  /** Total fortunes purchased on this device */
  total: number;
  /** ISO date string of last fortune (YYYY-MM-DD) */
  lastDate: string | null;
}

const EMPTY: StreakData = { current: 0, best: 0, total: 0, lastDate: null };

function today(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function yesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Load streak from localStorage. Returns empty streak on SSR or error. */
export function getStreak(): StreakData {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    return JSON.parse(raw) as StreakData;
  } catch {
    return EMPTY;
  }
}

/**
 * Record a fortune purchase. Call this when a fortune is revealed.
 * - Same day: increments total only (no double-counting the streak)
 * - Next day: extends the streak
 * - Gap of 2+ days: resets streak to 1
 * Returns the updated streak.
 */
export function recordFortune(): StreakData {
  const streak = getStreak();
  const t = today();

  // Already purchased today — just bump total
  if (streak.lastDate === t) {
    streak.total += 1;
    save(streak);
    return streak;
  }

  // Consecutive day — extend streak
  if (streak.lastDate === yesterday()) {
    streak.current += 1;
  } else {
    // Gap or first ever — start fresh streak
    streak.current = 1;
  }

  streak.total += 1;
  streak.lastDate = t;
  if (streak.current > streak.best) {
    streak.best = streak.current;
  }

  save(streak);
  return streak;
}

/**
 * Merge streaks from two sources (e.g. localStorage + Redis).
 * Most recent lastDate wins for current streak; best and total take max.
 */
export function mergeStreaks(
  local: StreakData,
  remote: StreakData,
): StreakData {
  if (!remote.lastDate) return { ...local };
  if (!local.lastDate) return { ...remote };

  const localIsNewer = local.lastDate >= remote.lastDate;

  return {
    current: localIsNewer ? local.current : remote.current,
    best: Math.max(local.best, remote.best),
    total: Math.max(local.total, remote.total),
    lastDate: localIsNewer ? local.lastDate : remote.lastDate,
  };
}

function save(data: StreakData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Storage full or unavailable — fail silently
  }
}
