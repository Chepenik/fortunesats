import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  getOrder: vi.fn(),
  claimFortune: vi.fn(),
  markOrderLightningPaid: vi.fn(),
  getUniqueRandomFortune: vi.fn(),
  withLuckyPrimeNumbers: vi.fn(),
  checkRateLimit: vi.fn(),
  getOrCreateDeviceId: vi.fn(),
  attachDeviceCookie: vi.fn(),
  resolveDisplayNameFromReq: vi.fn(),
  recordFortuneReveal: vi.fn(),
  recordActivity: vi.fn(),
  addToServerCollection: vi.fn(),
  recordServerStreak: vi.fn(),
  resolvePackCredentials: vi.fn(),
  attachClearPackCookie: vi.fn(),
  getStrikeInvoice: vi.fn(),
  recordSatsOnce: vi.fn(),
}));

vi.mock("@/lib/orders", () => ({
  getOrder: mocks.getOrder,
  claimFortune: mocks.claimFortune,
  markOrderLightningPaid: mocks.markOrderLightningPaid,
}));

vi.mock("@/lib/fortunes", () => ({
  getUniqueRandomFortune: mocks.getUniqueRandomFortune,
  withLuckyPrimeNumbers: mocks.withLuckyPrimeNumbers,
}));

vi.mock("@/lib/ratelimit", () => ({
  checkRateLimit: mocks.checkRateLimit,
}));

vi.mock("@/lib/device-id", () => ({
  getOrCreateDeviceId: mocks.getOrCreateDeviceId,
  attachDeviceCookie: mocks.attachDeviceCookie,
  resolveDisplayNameFromReq: mocks.resolveDisplayNameFromReq,
}));

vi.mock("@/lib/leaderboard", () => ({
  recordFortuneReveal: mocks.recordFortuneReveal,
}));

vi.mock("@/lib/activity", () => ({
  recordActivity: mocks.recordActivity,
}));

vi.mock("@/lib/collection-sync", () => ({
  addToServerCollection: mocks.addToServerCollection,
  recordServerStreak: mocks.recordServerStreak,
}));

vi.mock("@/lib/pack-session", () => ({
  resolvePackCredentials: mocks.resolvePackCredentials,
  attachClearPackCookie: mocks.attachClearPackCookie,
}));

vi.mock("@/lib/strike", () => ({
  getStrikeInvoice: mocks.getStrikeInvoice,
}));

vi.mock("@/lib/idempotency", () => ({
  recordSatsOnce: mocks.recordSatsOnce,
}));

const { POST } = await import("@/app/api/pack/fortune/route");

const baseOrder = {
  id: "order_1",
  secret: "secret_1",
  address: "",
  rail: "lightning",
  strikeInvoiceId: "invoice_1",
  amountSats: 10_000,
  fortunesTotal: 100,
  fortunesRemaining: 100,
  claimedFortunes: [],
  status: "pending",
  createdAt: "2026-05-11T00:00:00.000Z",
  expiresAt: "2026-05-11T01:00:00.000Z",
};

function packRequest() {
  return new Request("https://fortunesats.test/api/pack/fortune", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId: "order_1", secret: "secret_1" }),
  });
}

describe("POST /api/pack/fortune", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkRateLimit.mockResolvedValue(null);
    mocks.resolvePackCredentials.mockReturnValue({ orderId: "order_1", secret: "secret_1" });
    mocks.getUniqueRandomFortune.mockReturnValue({
      text: "Hold your keys. Hold your nerve. The signal compounds.",
      rarity: "rare",
    });
    mocks.withLuckyPrimeNumbers.mockImplementation((fortune) => ({
      ...fortune,
      luckyNumbers: [2, 3, 5],
    }));
    mocks.getOrCreateDeviceId.mockReturnValue({
      deviceId: "00000000-0000-4000-8000-000000000001",
      isNew: false,
    });
    mocks.resolveDisplayNameFromReq.mockReturnValue("Tester-0001");
    mocks.recordSatsOnce.mockResolvedValue(true);
    mocks.recordFortuneReveal.mockResolvedValue(undefined);
    mocks.recordActivity.mockResolvedValue(undefined);
    mocks.addToServerCollection.mockResolvedValue(undefined);
    mocks.recordServerStreak.mockResolvedValue(undefined);
    mocks.attachClearPackCookie.mockImplementation((res: Response) => res);
    mocks.attachDeviceCookie.mockImplementation((res: Response) => res);
  });

  it("syncs a paid Strike invoice and lets a Lightning pack claim a fortune", async () => {
    const paidOrder = { ...baseOrder, status: "lightning-paid", paidAt: "2026-05-11T00:01:00.000Z" };
    mocks.getOrder.mockResolvedValue(baseOrder);
    mocks.getStrikeInvoice.mockResolvedValue({
      invoiceId: "invoice_1",
      amount: { amount: "0.00010000", currency: "BTC" },
      state: "PAID",
      created: "2026-05-11T00:00:00.000Z",
    });
    mocks.markOrderLightningPaid.mockResolvedValue(paidOrder);
    mocks.claimFortune.mockResolvedValue({ success: true, fortunesRemaining: 99 });

    const res = await POST(packRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.fortune).toBe("Hold your keys. Hold your nerve. The signal compounds.");
    expect(json.fortunesRemaining).toBe(99);
    expect(mocks.markOrderLightningPaid).toHaveBeenCalledWith("order_1");
    expect(mocks.recordSatsOnce).toHaveBeenCalledWith(
      "order_1",
      "00000000-0000-4000-8000-000000000001",
      "Tester-0001",
      10_000,
    );
    expect(mocks.claimFortune).toHaveBeenCalledWith(
      "order_1",
      "secret_1",
      "Hold your keys. Hold your nerve. The signal compounds.",
    );
  });

  it("still rejects an unpaid Lightning pack", async () => {
    mocks.getOrder.mockResolvedValue(baseOrder);
    mocks.getStrikeInvoice.mockResolvedValue({
      invoiceId: "invoice_1",
      amount: { amount: "0.00010000", currency: "BTC" },
      state: "UNPAID",
      created: "2026-05-11T00:00:00.000Z",
    });

    const res = await POST(packRequest());
    const json = await res.json();

    expect(res.status).toBe(402);
    expect(json.error.code).toBe("not_paid");
    expect(mocks.claimFortune).not.toHaveBeenCalled();
  });
});
