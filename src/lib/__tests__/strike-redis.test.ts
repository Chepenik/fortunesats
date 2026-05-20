import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGet = vi.fn();
const mockSet = vi.fn();
const mockRedisInstance = { get: mockGet, set: mockSet };

vi.mock("@/lib/redis", () => ({
  getRedis: vi.fn(() => mockRedisInstance),
}));

const {
  claimWebhookEvent,
  acquireQuoteLock,
  saveCheckoutRecord,
  getCheckoutRecord,
  applyQuoteToRecord,
  makeCorrelationId,
} = await import("@/lib/strike");

import type { StrikeCheckoutRecord, StrikeQuote } from "@/lib/strike";

const BASE_RECORD: StrikeCheckoutRecord = {
  invoiceId: "inv_1",
  correlationId: "fortunesats-abc-123456",
  purchaseType: "fortune",
  amountSats: 100,
  amountBtc: "0.00000100",
  description: "One FortuneSats reveal",
  state: "UNPAID",
  successPath: "/fortune/success",
  createdAt: 1_700_000_000_000,
  lastSyncedAt: 1_700_000_000_000,
};

const SAMPLE_QUOTE: StrikeQuote = {
  quoteId: "q_1",
  lnInvoice: "lnbc100n1ptest",
  expiration: "2026-05-20T12:00:00Z",
  expirationInSec: 600,
  sourceAmount: { amount: "0.00000100", currency: "BTC" },
};

describe("applyQuoteToRecord", () => {
  it("attaches quote fields to a record", () => {
    const now = 1_700_000_001_000;
    const next = applyQuoteToRecord(BASE_RECORD, SAMPLE_QUOTE, now);
    expect(next.latestQuoteId).toBe("q_1");
    expect(next.latestLnInvoice).toBe("lnbc100n1ptest");
    expect(next.quoteExpiresAt).toBe(
      Math.floor(new Date("2026-05-20T12:00:00Z").getTime() / 1000),
    );
    expect(next.lastSyncedAt).toBe(now);
  });

  it("preserves all other record fields unchanged", () => {
    const next = applyQuoteToRecord(BASE_RECORD, SAMPLE_QUOTE, 999);
    expect(next.invoiceId).toBe("inv_1");
    expect(next.amountSats).toBe(100);
    expect(next.state).toBe("UNPAID");
    expect(next.successPath).toBe("/fortune/success");
  });

  it("does not mutate the original record", () => {
    const original = { ...BASE_RECORD };
    applyQuoteToRecord(BASE_RECORD, SAMPLE_QUOTE, 999);
    expect(BASE_RECORD).toEqual(original);
  });
});

describe("makeCorrelationId", () => {
  it("returns a non-empty string no longer than 40 chars", () => {
    const id = makeCorrelationId();
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
    expect(id.length).toBeLessThanOrEqual(40);
  });

  it("starts with the fortunesats- prefix", () => {
    expect(makeCorrelationId().startsWith("fortunesats-")).toBe(true);
  });

  it("produces unique IDs across rapid calls", () => {
    const ids = new Set(Array.from({ length: 50 }, makeCorrelationId));
    expect(ids.size).toBe(50);
  });
});

describe("claimWebhookEvent", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns true when SET NX succeeds (first handler wins)", async () => {
    mockSet.mockResolvedValueOnce("OK");
    const result = await claimWebhookEvent("evt_1");
    expect(result).toBe(true);
    expect(mockSet).toHaveBeenCalledWith(
      "strike-webhook-event:evt_1",
      expect.any(Number),
      { nx: true, ex: 14 * 24 * 60 * 60 },
    );
  });

  it("returns false when SET NX fails (duplicate event)", async () => {
    mockSet.mockResolvedValueOnce(null);
    expect(await claimWebhookEvent("evt_1")).toBe(false);
  });

  it("uses different Redis keys for different event IDs", async () => {
    mockSet.mockResolvedValue("OK");
    await claimWebhookEvent("evt_a");
    await claimWebhookEvent("evt_b");
    expect(mockSet.mock.calls[0][0]).toBe("strike-webhook-event:evt_a");
    expect(mockSet.mock.calls[1][0]).toBe("strike-webhook-event:evt_b");
  });
});

describe("acquireQuoteLock", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns true when lock is acquired (SET NX succeeds)", async () => {
    mockSet.mockResolvedValueOnce("OK");
    const result = await acquireQuoteLock("inv_1");
    expect(result).toBe(true);
    expect(mockSet).toHaveBeenCalledWith(
      "strike-quote-lock:inv_1",
      expect.any(Number),
      { nx: true, ex: 10 },
    );
  });

  it("returns false when another poller holds the lock", async () => {
    mockSet.mockResolvedValueOnce(null);
    expect(await acquireQuoteLock("inv_1")).toBe(false);
  });
});

describe("saveCheckoutRecord / getCheckoutRecord", () => {
  beforeEach(() => vi.clearAllMocks());

  it("saves with the correct key and 30-day TTL", async () => {
    mockSet.mockResolvedValueOnce("OK");
    await saveCheckoutRecord(BASE_RECORD);
    expect(mockSet).toHaveBeenCalledWith(
      "strike-invoice:inv_1",
      BASE_RECORD,
      { ex: 30 * 24 * 60 * 60 },
    );
  });

  it("returns the stored record on get", async () => {
    mockGet.mockResolvedValueOnce(BASE_RECORD);
    const result = await getCheckoutRecord("inv_1");
    expect(result).toEqual(BASE_RECORD);
    expect(mockGet).toHaveBeenCalledWith("strike-invoice:inv_1");
  });

  it("returns null when record is not found", async () => {
    mockGet.mockResolvedValueOnce(null);
    expect(await getCheckoutRecord("inv_missing")).toBeNull();
  });
});
