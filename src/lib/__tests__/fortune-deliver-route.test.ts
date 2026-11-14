import { describe, it, expect, vi, beforeEach } from "vitest";

/* ─── In-memory Redis stand-in ───────────────────────────── */

const store = new Map<string, unknown>();

const mockRedisInstance = {
  get: vi.fn(async (key: string) => store.get(key) ?? null),
  set: vi.fn(async (key: string, value: unknown) => {
    store.set(key, value);
    return "OK";
  }),
};

/* ─── Hoisted mocks ──────────────────────────────────────── */

const mocks = vi.hoisted(() => ({
  getFlags: vi.fn(),
  unavailableResponse: vi.fn(),
  checkRateLimit: vi.fn(),
  getStrikeInvoice: vi.fn(),
  getRedis: vi.fn(),
  getOrCreateDeviceId: vi.fn(),
  attachDeviceCookie: vi.fn(),
  resolveDisplayNameFromReq: vi.fn(),
  recordFortuneOnce: vi.fn(),
  addToServerCollection: vi.fn(),
  recordServerStreak: vi.fn(),
  getRandomFortune: vi.fn(),
  getLuckyPrimeNumbers: vi.fn(),
  withLuckyPrimeNumbers: vi.fn(),
}));

vi.mock("@/lib/flags", () => ({
  getFlags: mocks.getFlags,
  unavailableResponse: mocks.unavailableResponse,
}));

vi.mock("@/lib/ratelimit", () => ({
  checkRateLimit: mocks.checkRateLimit,
}));

vi.mock("@/lib/strike", () => ({
  getStrikeInvoice: mocks.getStrikeInvoice,
}));

vi.mock("@/lib/redis", () => ({
  getRedis: mocks.getRedis,
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

vi.mock("@/lib/fortunes", () => ({
  getRandomFortune: mocks.getRandomFortune,
  getLuckyPrimeNumbers: mocks.getLuckyPrimeNumbers,
  withLuckyPrimeNumbers: mocks.withLuckyPrimeNumbers,
}));

const { POST } = await import("@/app/api/fortune/deliver/route");

/* ─── Fixtures ───────────────────────────────────────────── */

const PAID_INVOICE = {
  invoiceId: "inv_abc123",
  state: "PAID",
  amount: { amount: "0.00000100", currency: "BTC" },
  created: "2026-05-31T00:00:00.000Z",
};

const FORTUNE_TEXT = "Stack sats. Stay humble. The chain never lies.";
const LUCKY_NUMBERS = [2, 3, 5, 7, 11, 13];

function deliverRequest(checkoutId = "inv_abc123") {
  return new Request("https://fortunesats.test/api/fortune/deliver", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ checkoutId }),
  });
}

/* ─── Tests ──────────────────────────────────────────────── */

describe("POST /api/fortune/deliver", () => {
  beforeEach(() => {
    store.clear();
    vi.clearAllMocks();

    mocks.getFlags.mockReturnValue({ fortuneSingleEnabled: true });
    mocks.checkRateLimit.mockResolvedValue(null);
    mocks.getRedis.mockReturnValue(mockRedisInstance);
    mocks.getStrikeInvoice.mockResolvedValue(PAID_INVOICE);
    mocks.withLuckyPrimeNumbers.mockReturnValue({
      text: FORTUNE_TEXT,
      rarity: "rare",
      luckyNumbers: LUCKY_NUMBERS,
    });
    mocks.getRandomFortune.mockReturnValue({ text: FORTUNE_TEXT, rarity: "rare" });
    mocks.getLuckyPrimeNumbers.mockReturnValue(LUCKY_NUMBERS);
    mocks.getOrCreateDeviceId.mockReturnValue({ deviceId: "device-001", isNew: false });
    mocks.resolveDisplayNameFromReq.mockReturnValue("Tester-0001");
    mocks.recordFortuneOnce.mockResolvedValue(true);
    mocks.addToServerCollection.mockResolvedValue(undefined);
    mocks.recordServerStreak.mockResolvedValue(undefined);
    mocks.attachDeviceCookie.mockImplementation((res: Response) => res);
    mocks.unavailableResponse.mockReturnValue(
      Response.json({ error: { code: "temporarily_unavailable" } }, { status: 503 }),
    );
  });

  describe("feature flag", () => {
    it("returns 503 when fortuneSingleEnabled is false", async () => {
      mocks.getFlags.mockReturnValue({ fortuneSingleEnabled: false });

      const res = await POST(deliverRequest());

      expect(res.status).toBe(503);
      expect(mocks.unavailableResponse).toHaveBeenCalledWith("Fortunes");
      expect(mocks.getStrikeInvoice).not.toHaveBeenCalled();
    });
  });

  describe("request validation", () => {
    it("returns 400 for malformed JSON body", async () => {
      const req = new Request("https://fortunesats.test/api/fortune/deliver", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not-json",
      });
      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error.code).toBe("invalid_body");
    });

    it("returns 400 when checkoutId is absent", async () => {
      const req = new Request("https://fortunesats.test/api/fortune/deliver", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error.code).toBe("invalid_param");
    });

    it("returns 400 when checkoutId is not a string", async () => {
      const req = new Request("https://fortunesats.test/api/fortune/deliver", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkoutId: 42 }),
      });
      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error.code).toBe("invalid_param");
    });
  });

  describe("payment verification", () => {
    it("returns 503 retriable when Strike throws a timeout error", async () => {
      mocks.getStrikeInvoice.mockRejectedValue(
        new Error("ETIMEDOUT: connection timed out"),
      );

      const res = await POST(deliverRequest());
      const json = await res.json();

      expect(res.status).toBe(503);
      expect(json.error.code).toBe("service_unavailable");
      expect(json.error.retriable).toBe(true);
      expect(json.error.detail).toBe("sync_timeout");
    });

    it("returns 503 retriable for non-timeout Strike errors", async () => {
      mocks.getStrikeInvoice.mockRejectedValue(new Error("500 internal server error"));

      const res = await POST(deliverRequest());
      const json = await res.json();

      expect(res.status).toBe(503);
      expect(json.error.retriable).toBe(true);
      expect(json.error.detail).toBe("checkout_error");
    });

    it("returns 402 when invoice is UNPAID", async () => {
      mocks.getStrikeInvoice.mockResolvedValue({ ...PAID_INVOICE, state: "UNPAID" });

      const res = await POST(deliverRequest());
      const json = await res.json();

      expect(res.status).toBe(402);
      expect(json.error.code).toBe("payment_required");
    });

    it("returns 402 when invoice currency is not BTC", async () => {
      mocks.getStrikeInvoice.mockResolvedValue({
        ...PAID_INVOICE,
        amount: { amount: "1.00", currency: "USD" },
      });

      const res = await POST(deliverRequest());
      const json = await res.json();

      expect(res.status).toBe(402);
      expect(json.error.code).toBe("payment_required");
    });
  });

  describe("happy path — cache miss", () => {
    it("generates a fortune, caches it, records leaderboard, returns 200", async () => {
      const res = await POST(deliverRequest());
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.fortune).toBe(FORTUNE_TEXT);
      expect(json.rarity).toBe("rare");
      expect(json.luckyNumbers).toEqual(LUCKY_NUMBERS);
      expect(typeof json.timestamp).toBe("string");

      // Fortune cached under the checkoutId key
      expect(mockRedisInstance.set).toHaveBeenCalledWith(
        "fortune:checkout:inv_abc123",
        expect.objectContaining({ fortune: FORTUNE_TEXT, rarity: "rare" }),
        { ex: 86_400 },
      );

      // Leaderboard, collection, and streak recorded
      expect(mocks.recordFortuneOnce).toHaveBeenCalledWith(
        "inv_abc123",
        "device-001",
        "Tester-0001",
        "rare",
        100,
      );
      expect(mocks.addToServerCollection).toHaveBeenCalledWith(
        "device-001",
        FORTUNE_TEXT,
        "rare",
      );
      expect(mocks.recordServerStreak).toHaveBeenCalledWith("device-001");
    });
  });

  describe("happy path — cache hit", () => {
    it("returns the cached fortune without re-generating", async () => {
      const cached = {
        fortune: "Sovereignty is not given. It is claimed.",
        rarity: "legendary",
        timestamp: "2026-05-31T00:00:00.000Z",
        luckyNumbers: [7, 11, 13, 17, 19, 23],
      };
      store.set("fortune:checkout:inv_abc123", cached);

      const res = await POST(deliverRequest());
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.fortune).toBe(cached.fortune);
      expect(json.rarity).toBe("legendary");
      expect(json.luckyNumbers).toEqual(cached.luckyNumbers);

      // No new fortune generated and no cache overwrite
      expect(mocks.getRandomFortune).not.toHaveBeenCalled();
      expect(mockRedisInstance.set).not.toHaveBeenCalled();
    });

    it("uses getLuckyPrimeNumbers when cached entry has no luckyNumbers", async () => {
      store.set("fortune:checkout:inv_abc123", {
        fortune: "Old cache entry.",
        rarity: "common",
        timestamp: "2026-05-01T00:00:00.000Z",
        // no luckyNumbers field
      });

      const res = await POST(deliverRequest());
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.luckyNumbers).toEqual(LUCKY_NUMBERS);
      expect(mocks.getLuckyPrimeNumbers).toHaveBeenCalled();
    });
  });

  describe("Redis unavailable", () => {
    it("falls back gracefully and still delivers a fortune", async () => {
      mocks.getRedis.mockReturnValue(null);

      const res = await POST(deliverRequest());
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.fortune).toBe(FORTUNE_TEXT);
      expect(mocks.withLuckyPrimeNumbers).toHaveBeenCalled();
    });
  });

  describe("device cookie", () => {
    it("attaches a Set-Cookie header for a new device", async () => {
      mocks.getOrCreateDeviceId.mockReturnValue({ deviceId: "device-new", isNew: true });

      const res = await POST(deliverRequest());

      expect(res.status).toBe(200);
      expect(mocks.attachDeviceCookie).toHaveBeenCalledWith(
        expect.any(Response),
        "device-new",
      );
    });

    it("does not attach a cookie for an existing device", async () => {
      const res = await POST(deliverRequest());

      expect(res.status).toBe(200);
      expect(mocks.attachDeviceCookie).not.toHaveBeenCalled();
    });
  });

  describe("rate limiting", () => {
    it("returns the 429 rate-limit response when the limit is exceeded", async () => {
      const limited = Response.json(
        { error: { code: "rate_limited" } },
        { status: 429 },
      );
      mocks.checkRateLimit.mockResolvedValue(limited);

      const res = await POST(deliverRequest());
      expect(res.status).toBe(429);
    });
  });
});
