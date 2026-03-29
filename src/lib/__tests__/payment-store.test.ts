import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Redis before importing payment-store
const mockGet = vi.fn();
const mockSet = vi.fn();
const mockRedisInstance = { get: mockGet, set: mockSet };

vi.mock("@/lib/redis", () => ({
  getRedis: vi.fn(() => mockRedisInstance),
}));

// Must import after mocking
const { isPaid, consumePayment, markPaidInRedis } = await import(
  "@/lib/payment-store"
);

// Note: payment-store has module-level local caches (localPaidCache, localConsumedCache)
// that persist across tests. Each test must use a unique hash to avoid cache hits
// from earlier tests.

describe("isPaid", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns true when Redis has the payment hash", async () => {
    mockGet.mockResolvedValueOnce(Date.now());
    expect(await isPaid("paid-hash-1")).toBe(true);
    expect(mockGet).toHaveBeenCalledWith("paid:paid-hash-1");
  });

  it("returns false when Redis does not have the hash", async () => {
    mockGet.mockResolvedValueOnce(null);
    expect(await isPaid("unknown-hash-1")).toBe(false);
  });

  it("throws when Redis is unreachable (fail closed)", async () => {
    // Use a hash never seen before so isLocallyPaid() returns false
    mockGet.mockRejectedValueOnce(new Error("Connection refused"));
    await expect(isPaid("fail-hash-1")).rejects.toThrow("Connection refused");
  });
});

describe("consumePayment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws when Redis is unreachable during isPaid check (fail closed)", async () => {
    // Use a hash never seen before so isLocallyPaid() returns false
    mockGet.mockRejectedValueOnce(new Error("Redis down"));
    await expect(consumePayment("fail-hash-2")).rejects.toThrow("Redis down");
  });

  it("returns false when payment hash is not paid", async () => {
    mockGet.mockResolvedValueOnce(null); // isPaid returns false
    expect(await consumePayment("unpaid-hash-1")).toBe(false);
  });

  it("throws when Redis SET NX fails (fail closed)", async () => {
    // isPaid succeeds (use unique hash)
    mockGet.mockResolvedValueOnce(Date.now());
    // SET NX fails
    mockSet.mockRejectedValueOnce(new Error("Redis write error"));
    await expect(consumePayment("consume-fail-1")).rejects.toThrow(
      "Redis write error"
    );
  });
});

describe("markPaidInRedis", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("writes to Redis with TTL", async () => {
    mockSet.mockResolvedValueOnce("OK");
    await markPaidInRedis("mark-hash-1");
    expect(mockSet).toHaveBeenCalledWith(
      "paid:mark-hash-1",
      expect.any(Number),
      { ex: 86_400 }
    );
  });
});
