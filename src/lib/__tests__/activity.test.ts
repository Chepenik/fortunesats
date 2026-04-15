import { describe, it, expect, vi, beforeEach } from "vitest";

/* ─── Mock Redis ─────────────────────────────────────────── */

const store = new Map<string, unknown[]>();

const mockPipeline = {
  lpush: vi.fn(),
  ltrim: vi.fn(),
  exec: vi.fn().mockResolvedValue([1, 1]),
};

const mockRedisInstance = {
  pipeline: vi.fn(() => mockPipeline),
  lrange: vi.fn(async (key: string, start: number, stop: number) => {
    const list = store.get(key) ?? [];
    // Redis lrange is inclusive on both ends; stop -1 means end
    const end = stop === -1 ? list.length - 1 : stop;
    return list.slice(start, end + 1);
  }),
};

vi.mock("@/lib/redis", () => ({
  getRedis: vi.fn(() => mockRedisInstance),
}));

const { recordActivity, getRecentActivity } = await import("@/lib/activity");

/* ─── Helpers ────────────────────────────────────────────── */

/** Pre-populate the mock store with serialized events. */
function seedEvents(count: number) {
  const list: string[] = [];
  for (let i = 0; i < count; i++) {
    list.push(JSON.stringify({ d: `User-${i}`, r: "common", t: Date.now() - i * 1000 }));
  }
  store.set("activity:recent", list);
}

/* ═══════════════════════════════════════════════════════════
   recordActivity
   ═══════════════════════════════════════════════════════════ */

describe("recordActivity", () => {
  beforeEach(() => {
    store.clear();
    vi.clearAllMocks();
    mockPipeline.exec.mockResolvedValue([1, 1]);
  });

  it("pipelines lpush and ltrim together", async () => {
    await recordActivity("SomeUser", "rare");

    expect(mockRedisInstance.pipeline).toHaveBeenCalledOnce();
    expect(mockPipeline.lpush).toHaveBeenCalledWith(
      "activity:recent",
      expect.any(String),
    );
    expect(mockPipeline.ltrim).toHaveBeenCalledWith("activity:recent", 0, 29);
    expect(mockPipeline.exec).toHaveBeenCalledOnce();
  });

  it("stores valid JSON with correct shape", async () => {
    const before = Date.now();
    await recordActivity("DisplayName", "legendary");
    const after = Date.now();

    const [, serialized] = mockPipeline.lpush.mock.calls[0];
    const parsed = JSON.parse(serialized);

    expect(parsed.d).toBe("DisplayName");
    expect(parsed.r).toBe("legendary");
    expect(parsed.t).toBeGreaterThanOrEqual(before);
    expect(parsed.t).toBeLessThanOrEqual(after);
  });

  it("works for all four rarities", async () => {
    const rarities = ["legendary", "epic", "rare", "common"] as const;
    for (const rarity of rarities) {
      vi.clearAllMocks();
      mockPipeline.exec.mockResolvedValue([1, 1]);
      await recordActivity("User", rarity);
      const [, serialized] = mockPipeline.lpush.mock.calls[0];
      expect(JSON.parse(serialized).r).toBe(rarity);
    }
  });

  it("does not throw when Redis pipeline fails", async () => {
    mockPipeline.exec.mockRejectedValueOnce(new Error("Redis down"));
    await expect(recordActivity("User", "common")).resolves.toBeUndefined();
  });

  it("does nothing when Redis is unavailable", async () => {
    const { getRedis } = await import("@/lib/redis");
    vi.mocked(getRedis).mockReturnValueOnce(null as never);

    await recordActivity("User", "common");
    expect(mockRedisInstance.pipeline).not.toHaveBeenCalled();
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

  it("returns empty array when the list is empty", async () => {
    store.set("activity:recent", []);
    const result = await getRecentActivity();
    expect(result).toEqual([]);
  });

  it("deserializes stored events into public shape", async () => {
    const ts = 1_700_000_000_000;
    store.set("activity:recent", [
      JSON.stringify({ d: "Alice", r: "epic", t: ts }),
    ]);

    const [event] = await getRecentActivity(1);

    expect(event.displayName).toBe("Alice");
    expect(event.rarity).toBe("epic");
    expect(event.timestamp).toBe(ts);
  });

  it("respects the limit parameter", async () => {
    seedEvents(20);
    const result = await getRecentActivity(5);
    expect(result.length).toBeLessThanOrEqual(5);
  });

  it("defaults to 10 events when no limit is given", async () => {
    seedEvents(20);
    // The mock lrange returns exactly limit items from the store
    const result = await getRecentActivity();
    expect(result.length).toBeLessThanOrEqual(10);
  });

  it("handles pre-parsed objects stored by older code paths", async () => {
    // Upstash sometimes auto-deserializes JSON — guard against that
    store.set("activity:recent", [
      { d: "Bob", r: "rare", t: 1_700_000_000_000 } as unknown as string,
    ]);

    const [event] = await getRecentActivity(1);
    expect(event.displayName).toBe("Bob");
    expect(event.rarity).toBe("rare");
  });

  it("returns empty array when Redis is unavailable", async () => {
    const { getRedis } = await import("@/lib/redis");
    vi.mocked(getRedis).mockReturnValueOnce(null as never);

    const result = await getRecentActivity();
    expect(result).toEqual([]);
    expect(mockRedisInstance.lrange).not.toHaveBeenCalled();
  });

  it("returns empty array when Redis throws", async () => {
    mockRedisInstance.lrange.mockRejectedValueOnce(new Error("Redis down"));
    const result = await getRecentActivity();
    expect(result).toEqual([]);
  });
});
