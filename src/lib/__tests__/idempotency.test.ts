import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Redis
const mockGet = vi.fn();
const mockSet = vi.fn();
const mockRedisInstance = { get: mockGet, set: mockSet };

vi.mock("@/lib/redis", () => ({
  getRedis: vi.fn(() => mockRedisInstance),
}));

// Mock leaderboard and activity
const mockRecordFortuneReveal = vi.fn().mockResolvedValue(undefined);
const mockRecordSatsSpent = vi.fn().mockResolvedValue(undefined);
const mockRecordActivity = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/leaderboard", () => ({
  recordFortuneReveal: (...args: unknown[]) => mockRecordFortuneReveal(...args),
  recordSatsSpent: (...args: unknown[]) => mockRecordSatsSpent(...args),
}));

vi.mock("@/lib/activity", () => ({
  recordActivity: (...args: unknown[]) => mockRecordActivity(...args),
}));

const { recordFortuneOnce, recordSatsOnce } = await import(
  "@/lib/idempotency"
);

describe("recordFortuneOnce", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("records on first call (SET NX succeeds)", async () => {
    mockSet.mockResolvedValueOnce("OK"); // SET NX succeeds

    const result = await recordFortuneOnce(
      "hash-1",
      "device-1",
      "TestUser",
      "rare",
      100,
    );

    expect(result).toBe(true);
    expect(mockSet).toHaveBeenCalledWith("recorded:hash-1", expect.any(Number), {
      nx: true,
      ex: 86_400,
    });
    expect(mockRecordFortuneReveal).toHaveBeenCalledWith(
      "device-1",
      "TestUser",
      "rare",
      100,
    );
    expect(mockRecordActivity).toHaveBeenCalledWith("TestUser", "rare");
  });

  it("skips recording on duplicate (SET NX returns null)", async () => {
    mockSet.mockResolvedValueOnce(null); // SET NX fails — already recorded

    const result = await recordFortuneOnce(
      "hash-2",
      "device-2",
      "TestUser2",
      "epic",
      100,
    );

    expect(result).toBe(false);
    expect(mockRecordFortuneReveal).not.toHaveBeenCalled();
    expect(mockRecordActivity).not.toHaveBeenCalled();
  });

  it("handles Redis failure gracefully", async () => {
    mockSet.mockRejectedValueOnce(new Error("Redis down"));

    const result = await recordFortuneOnce(
      "hash-3",
      "device-3",
      "TestUser3",
      "common",
      100,
    );

    expect(result).toBe(false);
    expect(mockRecordFortuneReveal).not.toHaveBeenCalled();
  });
});

describe("recordSatsOnce", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("records sats on first call", async () => {
    mockSet.mockResolvedValueOnce("OK");

    const result = await recordSatsOnce("order-1", "device-1", "TestUser", 10500);

    expect(result).toBe(true);
    expect(mockSet).toHaveBeenCalledWith(
      "recorded:sats:order-1",
      expect.any(Number),
      { nx: true, ex: 90 * 24 * 60 * 60 },
    );
    expect(mockRecordSatsSpent).toHaveBeenCalledWith("device-1", "TestUser", 10500);
  });

  it("skips on duplicate order", async () => {
    mockSet.mockResolvedValueOnce(null);

    const result = await recordSatsOnce("order-2", "device-2", "TestUser2", 10500);

    expect(result).toBe(false);
    expect(mockRecordSatsSpent).not.toHaveBeenCalled();
  });
});
