import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Rarity } from "@/lib/fortunes";
import { getRedis } from "@/lib/redis";

// ── Mock Redis ──

const store = new Map<string, unknown[]>();

const pipelineMock = {
  lpush: vi.fn(),
  ltrim: vi.fn(),
  exec: vi.fn().mockResolvedValue([]),
};

const mockRedis = {
  lrange: vi.fn(async (key: string, start: number, stop: number) => {
    const list = store.get(key) ?? [];
    return list.slice(start, stop + 1);
  }),
  pipeline: vi.fn(() => pipelineMock),
};

vi.mock("@/lib/redis", () => ({
  getRedis: vi.fn(() => mockRedis),
}));

const { recordActivity, getRecentActivity } = await import("@/lib/activity");

/* ═══════════════════════════════════════════════════════════
   recordActivity
   ═══════════════════════════════════════════════════════════ */

describe("recordActivity", () => {
  beforeEach(() => {
    store.clear();
    vi.clearAllMocks();
    pipelineMock.exec.mockResolvedValue([]);
  });

  it("pushes a compact event JSON to activity:recent", async () => {
    await recordActivity("alice-abc", "legendary");

    expect(pipelineMock.lpush).toHaveBeenCalledOnce();
    const [key, rawJson] = pipelineMock.lpush.mock.calls[0] as [string, string];
    expect(key).toBe("activity:recent");
    const parsed = JSON.parse(rawJson);
    expect(parsed.d).toBe("alice-abc");
    expect(parsed.r).toBe("legendary");
    expect(typeof parsed.t).toBe("number");
    expect(parsed.t).toBeGreaterThan(0);
  });

  it("trims the list to 30 entries after each push", async () => {
    await recordActivity("user", "common");
    expect(pipelineMock.ltrim).toHaveBeenCalledWith("activity:recent", 0, 29);
  });

  it("executes the pipeline", async () => {
    await recordActivity("user", "rare");
    expect(pipelineMock.exec).toHaveBeenCalledOnce();
  });

  it("does nothing when Redis is unavailable", async () => {
    vi.mocked(getRedis).mockReturnValueOnce(null as never);
    await expect(recordActivity("user", "common")).resolves.toBeUndefined();
    expect(pipelineMock.exec).not.toHaveBeenCalled();
  });

  it("swallows pipeline errors without throwing", async () => {
    pipelineMock.exec.mockRejectedValueOnce(new Error("Redis unavailable"));
    await expect(recordActivity("user", "epic")).resolves.toBeUndefined();
  });

  it("serializes all four rarities correctly", async () => {
    const rarities: Rarity[] = ["legendary", "epic", "rare", "common"];
    for (const r of rarities) {
      vi.clearAllMocks();
      pipelineMock.exec.mockResolvedValue([]);
      await recordActivity("user", r);
      const [, rawJson] = pipelineMock.lpush.mock.calls[0] as [string, string];
      expect(JSON.parse(rawJson).r).toBe(r);
    }
  });
});

/* ═══════════════════════════════════════════════════════════
   getRecentActivity
   ═══════════════════════════════════════════════════════════ */

describe("getRecentActivity", () => {
  beforeEach(() => {
    store.clear();
    vi.clearAllMocks();
  });

  it("returns an empty array when there are no events", async () => {
    const result = await getRecentActivity();
    expect(result).toEqual([]);
  });

  it("parses a stored JSON string event into an ActivityEvent", async () => {
    const ts = 1700000000000;
    store.set("activity:recent", [JSON.stringify({ d: "bob-xyz", r: "epic", t: ts })]);
    const [event] = await getRecentActivity(1);
    expect(event.displayName).toBe("bob-xyz");
    expect(event.rarity).toBe("epic");
    expect(event.timestamp).toBe(ts);
  });

  it("handles pre-parsed object events from the Upstash client", async () => {
    // Upstash HTTP client sometimes returns already-parsed JSON objects
    const ts = 1700000000001;
    store.set("activity:recent", [{ d: "carol-def", r: "rare", t: ts }]);
    const [event] = await getRecentActivity(1);
    expect(event.displayName).toBe("carol-def");
    expect(event.rarity).toBe("rare");
    expect(event.timestamp).toBe(ts);
  });

  it("returns all events when fewer exist than the limit", async () => {
    store.set("activity:recent", [
      JSON.stringify({ d: "u1", r: "common" as Rarity, t: 1 }),
      JSON.stringify({ d: "u2", r: "rare" as Rarity, t: 2 }),
    ]);
    const result = await getRecentActivity(10);
    expect(result).toHaveLength(2);
  });

  it("respects the limit parameter", async () => {
    store.set(
      "activity:recent",
      Array.from({ length: 25 }, (_, i) =>
        JSON.stringify({ d: `user${i}`, r: "common" as Rarity, t: i }),
      ),
    );
    expect(await getRecentActivity(5)).toHaveLength(5);
  });

  it("defaults to 10 events", async () => {
    store.set(
      "activity:recent",
      Array.from({ length: 25 }, (_, i) =>
        JSON.stringify({ d: `user${i}`, r: "common" as Rarity, t: i }),
      ),
    );
    expect(await getRecentActivity()).toHaveLength(10);
  });

  it("returns empty array when Redis is unavailable", async () => {
    vi.mocked(getRedis).mockReturnValueOnce(null as never);
    expect(await getRecentActivity()).toEqual([]);
  });

  it("returns empty array when Redis throws", async () => {
    mockRedis.lrange.mockRejectedValueOnce(new Error("connection refused"));
    expect(await getRecentActivity()).toEqual([]);
  });
});
