import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  getStrikeInvoice: vi.fn(),
  getLuckyPrimeNumbers: vi.fn(),
  getRandomFortune: vi.fn(),
  withLuckyPrimeNumbers: vi.fn(),
  getRedis: vi.fn(),
  checkRateLimit: vi.fn(),
  getOrCreateDeviceId: vi.fn(),
  attachDeviceCookie: vi.fn(),
  resolveDisplayNameFromReq: vi.fn(),
  recordFortuneOnce: vi.fn(),
  addToServerCollection: vi.fn(),
  recordServerStreak: vi.fn(),
  getFlags: vi.fn(),
  unavailableResponse: vi.fn(),
}));

vi.mock("@/lib/strike", () => ({
  getStrikeInvoice: mocks.getStrikeInvoice,
}));

vi.mock("@/lib/fortunes", () => ({
  getLuckyPrimeNumbers: mocks.getLuckyPrimeNumbers,
  getRandomFortune: mocks.getRandomFortune,
  withLuckyPrimeNumbers: mocks.withLuckyPrimeNumbers,
}));

vi.mock("@/lib/redis", () => ({
  getRedis: mocks.getRedis,
}));

vi.mock("@/lib/ratelimit", () => ({
  checkRateLimit: mocks.checkRateLimit,
}));

vi.mock("@/lib/device-id", () => ({
  getOrCreateDeviceId: mocks.getOrCreateDeviceId,
  attachDeviceCookie: mocks.attachDeviceCookie,
  resolveDisplayNameFromReq: mocks.resolveDisplayNameFromReq,
}));

vi.mock("@/lib/idempotency", () => ({
  recordFortuneOnce: mocks.recordFortuneOnce,
}));

vi.mock("@/lib/collection-sync", () => ({
  addToServerCollection: mocks.addToServerCollection,
  recordServerStreak: mocks.recordServerStreak,
}));

vi.mock("@/lib/flags", () => ({
  getFlags: mocks.getFlags,
  unavailableResponse: mocks.unavailableResponse,
}));

const { POST } = await import("@/app/api/fortune/deliver/route");

const PAID_INVOICE = {
  invoiceId: "inv_paid",
  amount: { amount: "0.00000100", currency: "BTC" },
  state: "PAID",
  created: "2026-06-06T00:00:00Z",
};

const FORTUNE_RESULT = {
  text: "Stack sats, be patient.",
  rarity: "common" as const,
  luckyNumbers: [2, 3, 5],
};

function deliverRequest(body: Record<string, unknown>) {
  return new Request("https://fortunesats.test/api/fortune/deliver", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/fortune/deliver", () => {
  const mockRedis = {
    get: vi.fn(),
    set: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkRateLimit.mockResolvedValue(null);
    mocks.getFlags.mockReturnValue({ fortuneSingleEnabled: true });
    mocks.getOrCreateDeviceId.mockReturnValue({
      deviceId: "00000000-0000-4000-8000-000000000001",
      isNew: false,
    });
    mocks.resolveDisplayNameFromReq.mockReturnValue("Tester-0001");
    mocks.getRedis.mockReturnValue(mockRedis);
    mockRedis.get.mockResolvedValue(null);
    mockRedis.set.mockResolvedValue("OK");
    mocks.withLuckyPrimeNumbers.mockReturnValue(FORTUNE_RESULT);
    mocks.getRandomFortune.mockReturnValue({ text: FORTUNE_RESULT.text, rarity: FORTUNE_RESULT.rarity });
    mocks.recordFortuneOnce.mockResolvedValue(true);
    mocks.addToServerCollection.mockResolvedValue(undefined);
    mocks.recordServerStreak.mockResolvedValue(undefined);
    mocks.attachDeviceCookie.mockImplementation((res: Response) => res);
  });

  it("delivers a fortune for a paid BTC invoice", async () => {
    mocks.getStrikeInvoice.mockResolvedValue(PAID_INVOICE);

    const res = await POST(deliverRequest({ checkoutId: "inv_paid" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.fortune).toBe(FORTUNE_RESULT.text);
    expect(json.rarity).toBe("common");
    expect(json.luckyNumbers).toEqual([2, 3, 5]);
    expect(json.timestamp).toBeDefined();
  });

  it("returns 402 for an unpaid invoice", async () => {
    mocks.getStrikeInvoice.mockResolvedValue({ ...PAID_INVOICE, state: "UNPAID" });

    const res = await POST(deliverRequest({ checkoutId: "inv_paid" }));
    const json = await res.json();

    expect(res.status).toBe(402);
    expect(json.error.code).toBe("payment_required");
  });

  it("returns 402 when invoice currency is not BTC", async () => {
    mocks.getStrikeInvoice.mockResolvedValue({
      ...PAID_INVOICE,
      amount: { amount: "1.00", currency: "USD" },
    });

    const res = await POST(deliverRequest({ checkoutId: "inv_paid" }));
    const json = await res.json();

    expect(res.status).toBe(402);
    expect(json.error.code).toBe("payment_required");
  });

  it("returns 503 with retriable flag when Strike throws", async () => {
    mocks.getStrikeInvoice.mockRejectedValue(new Error("network error"));

    const res = await POST(deliverRequest({ checkoutId: "inv_paid" }));
    const json = await res.json();

    expect(res.status).toBe(503);
    expect(json.error.code).toBe("service_unavailable");
    expect(json.error.retriable).toBe(true);
    expect(res.headers.get("Retry-After")).toBe("3");
  });

  it("returns 400 for malformed JSON body", async () => {
    const req = new Request("https://fortunesats.test/api/fortune/deliver", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json {{{",
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error.code).toBe("invalid_body");
    expect(mocks.getStrikeInvoice).not.toHaveBeenCalled();
  });

  it("returns 400 when checkoutId is missing", async () => {
    const res = await POST(deliverRequest({}));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error.code).toBe("invalid_param");
    expect(mocks.getStrikeInvoice).not.toHaveBeenCalled();
  });

  it("returns cached fortune on Redis cache hit without re-generating", async () => {
    mocks.getStrikeInvoice.mockResolvedValue(PAID_INVOICE);
    mockRedis.get.mockResolvedValue({
      fortune: "Buy when others fear.",
      rarity: "epic",
      timestamp: "2026-06-06T00:00:00Z",
      luckyNumbers: [7, 11, 13],
    });

    const res = await POST(deliverRequest({ checkoutId: "inv_paid" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.fortune).toBe("Buy when others fear.");
    expect(json.rarity).toBe("epic");
    expect(json.luckyNumbers).toEqual([7, 11, 13]);
    expect(mocks.getRandomFortune).not.toHaveBeenCalled();
  });

  it("calls recordFortuneOnce with correct checkoutId, deviceId, and sats", async () => {
    mocks.getStrikeInvoice.mockResolvedValue(PAID_INVOICE);

    await POST(deliverRequest({ checkoutId: "inv_paid" }));

    expect(mocks.recordFortuneOnce).toHaveBeenCalledWith(
      "inv_paid",
      "00000000-0000-4000-8000-000000000001",
      "Tester-0001",
      "common",
      100,
    );
  });

  it("returns 429 and skips Strike when rate limited", async () => {
    mocks.checkRateLimit.mockResolvedValue(
      Response.json(
        { error: { code: "rate_limited", message: "Too many requests" } },
        { status: 429 },
      ),
    );

    const res = await POST(deliverRequest({ checkoutId: "inv_paid" }));

    expect(res.status).toBe(429);
    expect(mocks.getStrikeInvoice).not.toHaveBeenCalled();
  });

  it("returns 503 when fortuneSingleEnabled flag is off", async () => {
    mocks.getFlags.mockReturnValue({ fortuneSingleEnabled: false });
    mocks.unavailableResponse.mockReturnValue(
      Response.json({ error: { code: "unavailable" } }, { status: 503 }),
    );

    const res = await POST(deliverRequest({ checkoutId: "inv_paid" }));

    expect(res.status).toBe(503);
    expect(mocks.getStrikeInvoice).not.toHaveBeenCalled();
  });

  it("attaches a device cookie when the device is new", async () => {
    mocks.getStrikeInvoice.mockResolvedValue(PAID_INVOICE);
    mocks.getOrCreateDeviceId.mockReturnValue({
      deviceId: "00000000-0000-4000-8000-000000000002",
      isNew: true,
    });

    const res = await POST(deliverRequest({ checkoutId: "inv_paid" }));

    expect(res.status).toBe(200);
    expect(mocks.attachDeviceCookie).toHaveBeenCalledWith(
      expect.any(Response),
      "00000000-0000-4000-8000-000000000002",
    );
  });

  it("still delivers a fortune when Redis is unavailable", async () => {
    mocks.getStrikeInvoice.mockResolvedValue(PAID_INVOICE);
    mocks.getRedis.mockReturnValue(null);

    const res = await POST(deliverRequest({ checkoutId: "inv_paid" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.fortune).toBeDefined();
  });
});
