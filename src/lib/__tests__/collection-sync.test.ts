import { describe, it, expect, vi, beforeEach } from "vitest";
import { mergeCollections, type CollectedFortune } from "@/lib/collection";
import { mergeStreaks, type StreakData } from "@/lib/streak";

/* ─── Mock Redis ─────────────────────────────────────────── */

const store = new Map<string, unknown>();
const mockRedisInstance = {
  get: vi.fn(async (key: string) => store.get(key) ?? null),
  set: vi.fn(async (key: string, value: unknown) => { store.set(key, value); return "OK"; }),
};

vi.mock("@/lib/redis", () => ({
  getRedis: vi.fn(() => mockRedisInstance),
}));

const {
  getServerCollection,
  setServerCollection,
  addToServerCollection,
  getServerStreak,
  setServerStreak,
  recordServerStreak,
} = await import("@/lib/collection-sync");

/* ─── Helpers ────────────────────────────────────────────── */

function fortune(text: string, rarity: "legendary" | "epic" | "rare" | "common" = "common", firstPulled = "2025-01-15T12:00:00.000Z", pullCount = 1): CollectedFortune {
  return { text, rarity, firstPulled, pullCount };
}

/* ═══════════════════════════════════════════════════════════
   mergeCollections
   ═══════════════════════════════════════════════════════════ */

describe("mergeCollections", () => {
  it("returns empty when both empty", () => {
    expect(mergeCollections([], [])).toEqual([]);
  });

  it("keeps local-only entries", () => {
    const local = [fortune("A", "rare")];
    const merged = mergeCollections(local, []);
    expect(merged).toHaveLength(1);
    expect(merged[0].text).toBe("A");
  });

  it("keeps remote-only entries", () => {
    const remote = [fortune("B", "epic")];
    const merged = mergeCollections([], remote);
    expect(merged).toHaveLength(1);
    expect(merged[0].text).toBe("B");
  });

  it("unions disjoint sets without duplicates", () => {
    const local = [fortune("A", "rare")];
    const remote = [fortune("B", "epic")];
    const merged = mergeCollections(local, remote);
    expect(merged).toHaveLength(2);
    expect(merged.map((f) => f.text).sort()).toEqual(["A", "B"]);
  });

  it("deduplicates by text — takes max pullCount and earliest firstPulled", () => {
    const local = [fortune("Same", "rare", "2025-01-10T00:00:00.000Z", 3)];
    const remote = [fortune("Same", "rare", "2025-01-15T00:00:00.000Z", 5)];
    const merged = mergeCollections(local, remote);
    expect(merged).toHaveLength(1);
    expect(merged[0].pullCount).toBe(5); // max
    expect(merged[0].firstPulled).toBe("2025-01-10T00:00:00.000Z"); // earliest
  });

  it("remote rarity wins when both exist", () => {
    const local = [fortune("Same", "common")];
    const remote = [fortune("Same", "legendary")];
    const merged = mergeCollections(local, remote);
    expect(merged[0].rarity).toBe("legendary");
  });

  it("sorts newest-first by firstPulled", () => {
    const local = [fortune("Old", "common", "2024-01-01T00:00:00.000Z")];
    const remote = [fortune("New", "rare", "2025-06-01T00:00:00.000Z")];
    const merged = mergeCollections(local, remote);
    expect(merged[0].text).toBe("New");
    expect(merged[1].text).toBe("Old");
  });
});

/* ═══════════════════════════════════════════════════════════
   mergeStreaks
   ═══════════════════════════════════════════════════════════ */

describe("mergeStreaks", () => {
  const empty: StreakData = { current: 0, best: 0, total: 0, lastDate: null };

  it("returns local when remote has no data", () => {
    const local: StreakData = { current: 3, best: 5, total: 10, lastDate: "2025-03-01" };
    expect(mergeStreaks(local, empty)).toEqual(local);
  });

  it("returns remote when local has no data", () => {
    const remote: StreakData = { current: 2, best: 4, total: 8, lastDate: "2025-03-02" };
    expect(mergeStreaks(empty, remote)).toEqual(remote);
  });

  it("local wins current when local is newer", () => {
    const local: StreakData = { current: 5, best: 5, total: 20, lastDate: "2025-03-05" };
    const remote: StreakData = { current: 3, best: 7, total: 15, lastDate: "2025-03-03" };
    const merged = mergeStreaks(local, remote);
    expect(merged.current).toBe(5); // local's current (newer)
    expect(merged.best).toBe(7); // max
    expect(merged.total).toBe(20); // max
    expect(merged.lastDate).toBe("2025-03-05"); // local (newer)
  });

  it("remote wins current when remote is newer", () => {
    const local: StreakData = { current: 2, best: 10, total: 30, lastDate: "2025-03-01" };
    const remote: StreakData = { current: 4, best: 4, total: 25, lastDate: "2025-03-04" };
    const merged = mergeStreaks(local, remote);
    expect(merged.current).toBe(4); // remote's current (newer)
    expect(merged.best).toBe(10); // max
    expect(merged.total).toBe(30); // max
    expect(merged.lastDate).toBe("2025-03-04"); // remote (newer)
  });

  it("same lastDate — local wins current", () => {
    const local: StreakData = { current: 3, best: 3, total: 5, lastDate: "2025-03-05" };
    const remote: StreakData = { current: 2, best: 2, total: 4, lastDate: "2025-03-05" };
    const merged = mergeStreaks(local, remote);
    expect(merged.current).toBe(3);
  });
});

/* ═══════════════════════════════════════════════════════════
   Server collection operations
   ═══════════════════════════════════════════════════════════ */

describe("server collection", () => {
  beforeEach(() => {
    store.clear();
    vi.clearAllMocks();
  });

  it("getServerCollection returns [] when key missing", async () => {
    const result = await getServerCollection("dev-1");
    expect(result).toEqual([]);
  });

  it("setServerCollection + getServerCollection round-trips", async () => {
    const data = [fortune("Hello", "epic")];
    await setServerCollection("dev-1", data);
    const result = await getServerCollection("dev-1");
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe("Hello");
  });

  it("addToServerCollection creates new entry", async () => {
    await addToServerCollection("dev-2", "New fortune", "rare");
    const result = await getServerCollection("dev-2");
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe("New fortune");
    expect(result[0].rarity).toBe("rare");
    expect(result[0].pullCount).toBe(1);
  });

  it("addToServerCollection increments pullCount on duplicate", async () => {
    await addToServerCollection("dev-3", "Dup", "common");
    await addToServerCollection("dev-3", "Dup", "common");
    await addToServerCollection("dev-3", "Dup", "common");
    const result = await getServerCollection("dev-3");
    expect(result).toHaveLength(1);
    expect(result[0].pullCount).toBe(3);
  });

  it("handles Redis failure gracefully", async () => {
    mockRedisInstance.get.mockRejectedValueOnce(new Error("Redis down"));
    const result = await getServerCollection("dev-4");
    expect(result).toEqual([]); // fails safe
  });
});

/* ═══════════════════════════════════════════════════════════
   Server streak operations
   ═══════════════════════════════════════════════════════════ */

describe("server streak", () => {
  beforeEach(() => {
    store.clear();
    vi.clearAllMocks();
  });

  it("getServerStreak returns empty when key missing", async () => {
    const result = await getServerStreak("dev-1");
    expect(result).toEqual({ current: 0, best: 0, total: 0, lastDate: null });
  });

  it("setServerStreak + getServerStreak round-trips", async () => {
    const data: StreakData = { current: 3, best: 5, total: 10, lastDate: "2025-03-01" };
    await setServerStreak("dev-1", data);
    const result = await getServerStreak("dev-1");
    expect(result).toEqual(data);
  });

  it("recordServerStreak starts a new streak on first call", async () => {
    await recordServerStreak("dev-5");
    const result = await getServerStreak("dev-5");
    expect(result.current).toBe(1);
    expect(result.best).toBe(1);
    expect(result.total).toBe(1);
    expect(result.lastDate).toBe(new Date().toISOString().slice(0, 10));
  });

  it("recordServerStreak bumps total on same day", async () => {
    await recordServerStreak("dev-6");
    await recordServerStreak("dev-6");
    const result = await getServerStreak("dev-6");
    expect(result.current).toBe(1);
    expect(result.total).toBe(2);
  });

  it("recordServerStreak extends streak on consecutive day", async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yStr = yesterday.toISOString().slice(0, 10);

    // Seed with yesterday's streak
    await setServerStreak("dev-7", { current: 2, best: 2, total: 5, lastDate: yStr });
    await recordServerStreak("dev-7");
    const result = await getServerStreak("dev-7");
    expect(result.current).toBe(3);
    expect(result.best).toBe(3);
    expect(result.total).toBe(6);
  });

  it("recordServerStreak resets streak after gap", async () => {
    // Seed with 3 days ago
    await setServerStreak("dev-8", { current: 5, best: 10, total: 20, lastDate: "2024-01-01" });
    await recordServerStreak("dev-8");
    const result = await getServerStreak("dev-8");
    expect(result.current).toBe(1); // reset
    expect(result.best).toBe(10); // preserved
    expect(result.total).toBe(21);
  });

  it("handles Redis failure gracefully", async () => {
    mockRedisInstance.get.mockRejectedValueOnce(new Error("Redis down"));
    // Should not throw
    await expect(recordServerStreak("dev-9")).resolves.toBeUndefined();
  });
});
