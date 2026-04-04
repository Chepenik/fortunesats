import { describe, it, expect, vi, beforeEach } from "vitest";

/* ─── Mock Redis with in-memory Map ───────────────────────── */

const store = new Map<string, { value: unknown; ex?: number }>();

const mockRedisInstance = {
  get: vi.fn(async (key: string) => {
    const entry = store.get(key);
    return entry ? entry.value : null;
  }),
  set: vi.fn(async (key: string, value: unknown, opts?: { nx?: boolean; ex?: number }) => {
    if (opts?.nx && store.has(key)) return null; // NX: don't overwrite
    store.set(key, { value, ex: opts?.ex });
    return "OK";
  }),
};

vi.mock("@/lib/redis", () => ({
  getRedis: vi.fn(() => mockRedisInstance),
}));

// Mock getRandomFortune to return a deterministic fortune
vi.mock("@/lib/fortunes", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/fortunes")>();
  return {
    ...actual,
    getRandomFortune: vi.fn(() => ({
      text: "The obstacle is the way. — Marcus Aurelius",
      rarity: "legendary" as const,
    })),
  };
});

const { createGift, getGift, claimGift } = await import("@/lib/gift");

describe("createGift", () => {
  beforeEach(() => {
    store.clear();
    vi.clearAllMocks();
  });

  it("creates a gift with correct fields", async () => {
    const gift = await createGift("checkout-1", "device-sender");

    expect(gift).not.toBeNull();
    expect(gift!.fortune).toBe("The obstacle is the way. — Marcus Aurelius");
    expect(gift!.rarity).toBe("legendary");
    expect(gift!.status).toBe("paid");
    expect(gift!.senderDeviceId).toBe("device-sender");
    expect(gift!.checkoutId).toBe("checkout-1");
    expect(gift!.token).toBeTruthy();
    expect(gift!.expiresAt).toBeTruthy();
  });

  it("is idempotent — same checkoutId returns same gift", async () => {
    const gift1 = await createGift("checkout-2", "device-sender");
    const gift2 = await createGift("checkout-2", "device-sender");

    expect(gift1!.token).toBe(gift2!.token);
    expect(gift1!.fortune).toBe(gift2!.fortune);
  });

  it("different checkoutIds produce different gifts", async () => {
    const gift1 = await createGift("checkout-3", "device-sender");
    const gift2 = await createGift("checkout-4", "device-sender");

    expect(gift1!.token).not.toBe(gift2!.token);
  });
});

describe("getGift", () => {
  beforeEach(() => {
    store.clear();
    vi.clearAllMocks();
  });

  it("returns null for nonexistent token", async () => {
    const gift = await getGift("nonexistent-token");
    expect(gift).toBeNull();
  });

  it("returns the gift for a valid token", async () => {
    const created = await createGift("checkout-5", "device-sender");
    const fetched = await getGift(created!.token);

    expect(fetched).not.toBeNull();
    expect(fetched!.fortune).toBe(created!.fortune);
    expect(fetched!.status).toBe("paid");
  });

  it("returns expired status for past-expiry gifts", async () => {
    const created = await createGift("checkout-6", "device-sender");

    // Manually backdate the expiresAt in the store
    const key = `gift:${created!.token}`;
    const entry = store.get(key);
    if (entry) {
      const gift = entry.value as Record<string, unknown>;
      gift.expiresAt = new Date(Date.now() - 1000).toISOString();
      store.set(key, { ...entry, value: gift });
    }

    const fetched = await getGift(created!.token);
    expect(fetched!.status).toBe("expired");
  });
});

describe("claimGift", () => {
  beforeEach(() => {
    store.clear();
    vi.clearAllMocks();
  });

  it("successfully claims a paid gift", async () => {
    const created = await createGift("checkout-7", "device-sender");
    const result = await claimGift(created!.token, "device-recipient");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.gift.fortune).toBe("The obstacle is the way. — Marcus Aurelius");
      expect(result.gift.rarity).toBe("legendary");
      expect(result.gift.status).toBe("claimed");
      expect(result.gift.claimerDeviceId).toBe("device-recipient");
      expect(result.gift.claimedAt).toBeTruthy();
    }
  });

  it("prevents double-claim (replay protection)", async () => {
    const created = await createGift("checkout-8", "device-sender");

    const first = await claimGift(created!.token, "device-a");
    expect(first.success).toBe(true);

    const second = await claimGift(created!.token, "device-b");
    expect(second.success).toBe(false);
    if (!second.success) {
      expect(second.error).toContain("already been claimed");
      expect(second.status).toBe(409);
    }
  });

  it("rejects claim on nonexistent token", async () => {
    const result = await claimGift("fake-token", "device-x");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.status).toBe(404);
    }
  });

  it("rejects claim on expired gift", async () => {
    const created = await createGift("checkout-9", "device-sender");

    // Backdate expiry
    const key = `gift:${created!.token}`;
    const entry = store.get(key);
    if (entry) {
      const gift = entry.value as Record<string, unknown>;
      gift.expiresAt = new Date(Date.now() - 1000).toISOString();
      store.set(key, { ...entry, value: gift });
    }

    const result = await claimGift(created!.token, "device-recipient");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("expired");
      expect(result.status).toBe(410);
    }
  });

  it("assigns fortune to recipient device (different from sender)", async () => {
    const created = await createGift("checkout-10", "device-sender");
    const result = await claimGift(created!.token, "device-recipient-new");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.gift.senderDeviceId).toBe("device-sender");
      expect(result.gift.claimerDeviceId).toBe("device-recipient-new");
    }
  });

  it("concurrent claims — only one wins", async () => {
    const created = await createGift("checkout-11", "device-sender");
    const token = created!.token;

    // Simulate concurrent claims
    const results = await Promise.all([
      claimGift(token, "device-a"),
      claimGift(token, "device-b"),
      claimGift(token, "device-c"),
    ]);

    const successes = results.filter((r) => r.success);
    const failures = results.filter((r) => !r.success);

    expect(successes.length).toBe(1);
    expect(failures.length).toBe(2);
  });
});
