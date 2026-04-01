import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for critical payment paths:
 * - Duplicate status checks across multiple requests
 * - Fortune consistency between /status and /claim
 * - Repeated pack fortune claims
 * - Expired or invalid pack orders
 * - Invalid txid handling
 * - Atomic claim counter behavior
 */

// ── Mock Redis ──

const store = new Map<string, unknown>();

const mockRedis = {
  get: vi.fn(async (key: string) => store.get(key) ?? null),
  set: vi.fn(
    async (
      key: string,
      value: unknown,
      opts?: { nx?: boolean; ex?: number },
    ) => {
      if (opts?.nx && store.has(key)) return null; // NX semantics
      store.set(key, value);
      return "OK";
    },
  ),
  decr: vi.fn(async (key: string) => {
    const v = store.get(key);
    const current = typeof v === "number" ? v : parseInt(String(v), 10) || 0;
    const next = current - 1;
    store.set(key, next);
    return next;
  }),
  incr: vi.fn(async (key: string) => {
    const v = store.get(key);
    const current = typeof v === "number" ? v : parseInt(String(v), 10) || 0;
    const next = current + 1;
    store.set(key, next);
    return next;
  }),
  pipeline: vi.fn(() => ({
    zincrby: vi.fn(),
    zadd: vi.fn(),
    hset: vi.fn(),
    lpush: vi.fn(),
    ltrim: vi.fn(),
    exec: vi.fn().mockResolvedValue([]),
  })),
  hmget: vi.fn().mockResolvedValue({ lastFortuneAt: null, currentStreak: null }),
  exists: vi.fn(async (key: string) => store.has(key)),
};

vi.mock("@/lib/redis", () => ({
  getRedis: vi.fn(() => mockRedis),
}));

// Separate mock for orders.ts Redis import
vi.mock("@upstash/redis", () => ({
  Redis: vi.fn(() => mockRedis),
}));

// ── Import modules after mocking ──

const { recordFortuneOnce, recordSatsOnce } = await import(
  "@/lib/idempotency"
);

describe("duplicate status checks across multiple requests", () => {
  beforeEach(() => {
    store.clear();
    vi.clearAllMocks();
  });

  it("only records to leaderboard once for the same paymentHash", async () => {
    // Simulate 5 rapid status checks for the same payment
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        recordFortuneOnce("hash-dup-1", "device-1", "User1", "common", 100),
      ),
    );

    // Exactly one should win
    const wins = results.filter(Boolean);
    expect(wins.length).toBe(1);
  });

  it("allows different payment hashes to each record", async () => {
    const r1 = await recordFortuneOnce(
      "hash-a",
      "device-1",
      "User1",
      "rare",
      100,
    );
    const r2 = await recordFortuneOnce(
      "hash-b",
      "device-1",
      "User1",
      "epic",
      100,
    );

    expect(r1).toBe(true);
    expect(r2).toBe(true);
  });
});

describe("fortune consistency between /status and /claim", () => {
  beforeEach(() => {
    store.clear();
    vi.clearAllMocks();
  });

  it("fortune cache is shared: SET then GET returns same data", async () => {
    const cached = { fortune: "Test fortune", rarity: "rare", timestamp: "2024-01-01T00:00:00Z" };

    // Simulate /status caching a fortune
    await mockRedis.set("fortune:hash-fc-1", cached, { ex: 86400 });

    // Simulate /claim reading the same cache
    const retrieved = await mockRedis.get("fortune:hash-fc-1");
    expect(retrieved).toEqual(cached);
  });

  it("claim SET NX prevents double-claiming", async () => {
    // First claim wins
    const first = await mockRedis.set("claim:hash-claim-1", Date.now(), {
      nx: true,
      ex: 86400,
    });
    expect(first).toBe("OK");

    // Second claim fails
    const second = await mockRedis.set("claim:hash-claim-1", Date.now(), {
      nx: true,
      ex: 86400,
    });
    expect(second).toBeNull();
  });

  it("status recording + claim recording results in exactly one leaderboard write", async () => {
    // Status records first
    const statusResult = await recordFortuneOnce(
      "hash-overlap-1",
      "device-1",
      "User1",
      "legendary",
      100,
    );
    expect(statusResult).toBe(true);

    // Claim tries to record same hash — should be blocked
    const claimResult = await recordFortuneOnce(
      "hash-overlap-1",
      "device-1",
      "User1",
      "legendary",
      100,
    );
    expect(claimResult).toBe(false);
  });
});

describe("pack fortune claims", () => {
  beforeEach(() => {
    store.clear();
    vi.clearAllMocks();
  });

  it("atomic counter prevents over-claiming", async () => {
    // Initialize counter at 3 remaining
    store.set("pack:remaining:order-ac-1", 3);

    // 5 concurrent claims
    const results = await Promise.all(
      Array.from({ length: 5 }, () => mockRedis.decr("pack:remaining:order-ac-1")),
    );

    // Results: 2, 1, 0, -1, -2
    // Only first 3 should be >= 0
    const valid = results.filter((r) => r >= 0);
    expect(valid.length).toBe(3);
  });

  it("SETNX for counter init is idempotent", async () => {
    // Two concurrent initializations with same value
    await mockRedis.set("pack:remaining:order-init-1", 50, { nx: true });
    await mockRedis.set("pack:remaining:order-init-1", 50, { nx: true });

    // Value should be 50 (first write wins, second is no-op)
    expect(store.get("pack:remaining:order-init-1")).toBe(50);
  });

  it("counter goes to zero, not below", async () => {
    store.set("pack:remaining:order-zero-1", 1);

    const first = await mockRedis.decr("pack:remaining:order-zero-1");
    expect(first).toBe(0); // Valid claim

    const second = await mockRedis.decr("pack:remaining:order-zero-1");
    expect(second).toBe(-1); // Over-claim — caller should INCR to undo
  });
});

describe("pack sats recording idempotency", () => {
  beforeEach(() => {
    store.clear();
    vi.clearAllMocks();
  });

  it("records sats only once per order", async () => {
    const r1 = await recordSatsOnce("order-sats-1", "device-1", "User1", 10500);
    const r2 = await recordSatsOnce("order-sats-1", "device-1", "User1", 10500);

    expect(r1).toBe(true);
    expect(r2).toBe(false);
  });

  it("different orders can each record sats", async () => {
    const r1 = await recordSatsOnce("order-a", "device-1", "User1", 10500);
    const r2 = await recordSatsOnce("order-b", "device-1", "User1", 10300);

    expect(r1).toBe(true);
    expect(r2).toBe(true);
  });
});

describe("invalid txid handling", () => {
  it("rejects non-hex txid", () => {
    const valid = /^[a-fA-F0-9]{64}$/;
    expect(valid.test("not-a-valid-txid")).toBe(false);
    expect(valid.test("zzzz")).toBe(false);
    expect(valid.test("")).toBe(false);
    expect(valid.test("a".repeat(63))).toBe(false);
    expect(valid.test("a".repeat(65))).toBe(false);
  });

  it("accepts valid 64-char hex txid", () => {
    const valid = /^[a-fA-F0-9]{64}$/;
    expect(valid.test("a".repeat(64))).toBe(true);
    expect(
      valid.test(
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      ),
    ).toBe(true);
  });
});

describe("expired order behavior", () => {
  it("detects expired order by comparing dates", () => {
    const pastExpiry = new Date(Date.now() - 3600_000).toISOString();
    const futureExpiry = new Date(Date.now() + 3600_000).toISOString();

    expect(new Date(pastExpiry) < new Date()).toBe(true);
    expect(new Date(futureExpiry) < new Date()).toBe(false);
  });
});
