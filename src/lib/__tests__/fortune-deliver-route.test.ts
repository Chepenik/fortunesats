import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  getStrikeInvoice: vi.fn(),
  getLuckyPrimeNumbers: vi.fn(),
  getRandomFortune: vi.fn(),
  withLuckyPrimeNumbers: vi.fn(),
  getRedis: vi.fn(),
  redisGet: vi.fn(),
  redisSet: vi.fn(),
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

vi.mock("@/lib/strike", () => ({ getStrikeInvoice: mocks.getStrikeInvoice }));
vi.mock("@/lib/fortunes", () => ({
  getLuckyPrimeNumbers: mocks.getLuckyPrimeNumbers,
  getRandomFortune: mocks.getRandomFortune,
  withLuckyPrimeNumbers: mocks.withLuckyPrimeNumbers,
}));
vi.mock("@/lib/redis", () => ({ getRedis: mocks.getRedis }));
vi.mock("@/lib/ratelimit", () => ({ checkRateLimit: mocks.checkRateLimit }));
vi.mock("@/lib/device-id", () => ({
  getOrCreateDeviceId: mocks.getOrCreateDeviceId,
  attachDeviceCookie: mocks.attachDeviceCookie,
  resolveDisplayNameFromReq: mocks.resolveDisplayNameFromReq,
}));
vi.mock("@/lib/idempotency", () => ({ recordFortuneOnce: mocks.recordFortuneOnce }));
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
  invoiceId: "inv_001",
  amount: { amount: "0.00000100", currency: "BTC" },
  state: "PAID",
  created: "2026-07-20T00:00:00.000Z",
};

const FORTUNE_TEXT = "Stack sats. Stack patience. The signal compounds.";
const FORTUNE_RARITY = "common";
const LUCKY_NUMBERS = [2, 3, 5];

function makeRequest(body: unknown = { checkoutId: "inv_001" }) {
  return new Request("https://fortunesats.test/api/fortune/deliver", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/fortune/deliver", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getFlags.mockReturnValue({ fortuneSingleEnabled: true });
    mocks.unavailableResponse.mockImplementation((feature: string) =>
      Response.json(
        { error: { code: "temporarily_unavailable", message: `${feature} is temporarily unavailable.` } },
        { status: 503 },
      ),
    );
    mocks.checkRateLimit.mockResolvedValue(null);
    mocks.getStrikeInvoice.mockResolvedValue(PAID_INVOICE);
    mocks.withLuckyPrimeNumbers.mockReturnValue({
      text: FORTUNE_TEXT,
      rarity: FORTUNE_RARITY,
      luckyNumbers: LUCKY_NUMBERS,
    });
    mocks.getRandomFortune.mockReturnValue({ text: FORTUNE_TEXT, rarity: FORTUNE_RARITY });
    mocks.getLuckyPrimeNumbers.mockReturnValue(LUCKY_NUMBERS);
    mocks.redisGet.mockResolvedValue(null);
    mocks.redisSet.mockResolvedValue("OK");
    mocks.getRedis.mockReturnValue({ get: mocks.redisGet, set: mocks.redisSet });
    mocks.getOrCreateDeviceId.mockReturnValue({
      deviceId: "00000000-0000-4000-8000-000000000001",
      isNew: false,
    });
    mocks.resolveDisplayNameFromReq.mockReturnValue("Tester-0001");
    mocks.recordFortuneOnce.mockResolvedValue(true);
    mocks.addToServerCollection.mockResolvedValue(undefined);
    mocks.recordServerStreak.mockResolvedValue(undefined);
    mocks.attachDeviceCookie.mockImplementation((res: Response) => res);
  });

  it("returns 503 when fortuneSingleEnabled flag is off", async () => {
    mocks.getFlags.mockReturnValue({ fortuneSingleEnabled: false });
    const res = await POST(makeRequest());
    expect(res.status).toBe(503);
    expect(mocks.unavailableResponse).toHaveBeenCalledWith("Fortunes");
    expect(mocks.getStrikeInvoice).not.toHaveBeenCalled();
  });

  it("returns 429 when rate limited", async () => {
    mocks.checkRateLimit.mockResolvedValue(
      Response.json({ error: { code: "rate_limited" } }, { status: 429 }),
    );
    const res = await POST(makeRequest());
    expect(res.status).toBe(429);
    expect(mocks.getStrikeInvoice).not.toHaveBeenCalled();
  });

  it("returns 400 for unparseable JSON body", async () => {
    const req = new Request("https://fortunesats.test/api/fortune/deliver", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json{{{",
    });
    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error.code).toBe("invalid_body");
  });

  it("returns 400 when checkoutId is missing", async () => {
    const res = await POST(makeRequest({}));
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error.code).toBe("invalid_param");
  });

  it("returns 400 when checkoutId is not a string", async () => {
    const res = await POST(makeRequest({ checkoutId: 42 }));
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error.code).toBe("invalid_param");
  });

  it("returns 503 with retriable=true on Strike API error", async () => {
    mocks.getStrikeInvoice.mockRejectedValue(new Error("Connection refused"));
    const res = await POST(makeRequest());
    const json = await res.json();
    expect(res.status).toBe(503);
    expect(json.error.retriable).toBe(true);
    expect(json.error.detail).toBe("checkout_error");
    expect(res.headers.get("Retry-After")).toBe("3");
  });

  it("returns 503 with detail=sync_timeout on Strike timeout", async () => {
    mocks.getStrikeInvoice.mockRejectedValue(new Error("timed out after 10000ms"));
    const res = await POST(makeRequest());
    const json = await res.json();
    expect(res.status).toBe(503);
    expect(json.error.detail).toBe("sync_timeout");
  });

  it("returns 402 when invoice state is UNPAID", async () => {
    mocks.getStrikeInvoice.mockResolvedValue({ ...PAID_INVOICE, state: "UNPAID" });
    const res = await POST(makeRequest());
    const json = await res.json();
    expect(res.status).toBe(402);
    expect(json.error.code).toBe("payment_required");
    expect(json.error.retriable).toBe(true);
  });

  it("returns 402 when invoice currency is not BTC", async () => {
    mocks.getStrikeInvoice.mockResolvedValue({
      ...PAID_INVOICE,
      amount: { amount: "10.00", currency: "USD" },
    });
    const res = await POST(makeRequest());
    const json = await res.json();
    expect(res.status).toBe(402);
    expect(json.error.code).toBe("payment_required");
  });

  it("generates and caches fortune on Redis cache miss", async () => {
    const res = await POST(makeRequest());
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.fortune).toBe(FORTUNE_TEXT);
    expect(json.rarity).toBe(FORTUNE_RARITY);
    expect(json.luckyNumbers).toEqual(LUCKY_NUMBERS);
    expect(mocks.withLuckyPrimeNumbers).toHaveBeenCalled();
    expect(mocks.redisSet).toHaveBeenCalledWith(
      "fortune:checkout:inv_001",
      expect.objectContaining({ fortune: FORTUNE_TEXT, rarity: FORTUNE_RARITY }),
      { ex: 86_400 },
    );
  });

  it("returns cached fortune and skips generation on cache hit", async () => {
    mocks.redisGet.mockResolvedValue({
      fortune: FORTUNE_TEXT,
      rarity: FORTUNE_RARITY,
      timestamp: "2026-07-20T00:00:00.000Z",
      luckyNumbers: LUCKY_NUMBERS,
    });
    const res = await POST(makeRequest());
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.fortune).toBe(FORTUNE_TEXT);
    expect(json.timestamp).toBe("2026-07-20T00:00:00.000Z");
    expect(mocks.withLuckyPrimeNumbers).not.toHaveBeenCalled();
    expect(mocks.redisSet).not.toHaveBeenCalled();
  });

  it("falls back to fresh fortune on Redis cache error", async () => {
    mocks.redisGet.mockRejectedValue(new Error("Redis connection refused"));
    const res = await POST(makeRequest());
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.fortune).toBe(FORTUNE_TEXT);
    expect(mocks.withLuckyPrimeNumbers).toHaveBeenCalled();
  });

  it("generates fortune without Redis when getRedis returns null", async () => {
    mocks.getRedis.mockReturnValue(null);
    const res = await POST(makeRequest());
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.fortune).toBe(FORTUNE_TEXT);
    expect(mocks.redisSet).not.toHaveBeenCalled();
  });

  it("calls recordFortuneOnce with checkoutId, deviceId, displayName, rarity, and 100 sats", async () => {
    await POST(makeRequest());
    expect(mocks.recordFortuneOnce).toHaveBeenCalledWith(
      "inv_001",
      "00000000-0000-4000-8000-000000000001",
      "Tester-0001",
      FORTUNE_RARITY,
      100,
    );
  });

  it("attaches device cookie for new devices", async () => {
    mocks.getOrCreateDeviceId.mockReturnValue({
      deviceId: "00000000-0000-4000-8000-000000000002",
      isNew: true,
    });
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(mocks.attachDeviceCookie).toHaveBeenCalled();
  });

  it("does not attach device cookie for existing devices", async () => {
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(mocks.attachDeviceCookie).not.toHaveBeenCalled();
  });
});
