import { describe, it, expect, vi, afterEach } from "vitest";
import { getFlags, unavailableResponse } from "@/lib/flags";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getFlags — defaults", () => {
  it("returns safe defaults when no env vars are set", () => {
    const flags = getFlags();
    expect(flags.fortuneSingleEnabled).toBe(true);
    expect(flags.fortunePackEnabled).toBe(true);
    expect(flags.leaderboardEnabled).toBe(true);
    expect(flags.activityFeedEnabled).toBe(true);
    expect(flags.freeFortunePromo).toBe(false);
    expect(flags.legendaryRateMultiplier).toBe(1.0);
    expect(flags.seasonalPoolEnabled).toBe(false);
    expect(flags.giftEnabled).toBe(true);
  });
});

describe("envBool parsing", () => {
  it('enables a default-true flag when set to "false"', () => {
    vi.stubEnv("FORTUNE_SINGLE_ENABLED", "false");
    expect(getFlags().fortuneSingleEnabled).toBe(false);
  });

  it('enables a default-false flag when set to "true"', () => {
    vi.stubEnv("FREE_FORTUNE_PROMO", "true");
    expect(getFlags().freeFortunePromo).toBe(true);
  });

  it('treats "1" as true', () => {
    vi.stubEnv("FREE_FORTUNE_PROMO", "1");
    expect(getFlags().freeFortunePromo).toBe(true);
  });

  it("falls back to default for empty string", () => {
    vi.stubEnv("FORTUNE_SINGLE_ENABLED", "");
    expect(getFlags().fortuneSingleEnabled).toBe(true);
  });

  it("falls back to default for unrecognised string (not 'true' or '1')", () => {
    vi.stubEnv("FREE_FORTUNE_PROMO", "yes");
    expect(getFlags().freeFortunePromo).toBe(false);
  });

  it('treats "0" as false (neither "true" nor "1")', () => {
    vi.stubEnv("FREE_FORTUNE_PROMO", "0");
    expect(getFlags().freeFortunePromo).toBe(false);
  });
});

describe("envNumber parsing — legendaryRateMultiplier [0.5, 4.0]", () => {
  it("applies a valid in-range multiplier", () => {
    vi.stubEnv("LEGENDARY_RATE_MULTIPLIER", "2.5");
    expect(getFlags().legendaryRateMultiplier).toBe(2.5);
  });

  it("accepts the exact minimum boundary (0.5)", () => {
    vi.stubEnv("LEGENDARY_RATE_MULTIPLIER", "0.5");
    expect(getFlags().legendaryRateMultiplier).toBe(0.5);
  });

  it("accepts the exact maximum boundary (4.0)", () => {
    vi.stubEnv("LEGENDARY_RATE_MULTIPLIER", "4.0");
    expect(getFlags().legendaryRateMultiplier).toBe(4.0);
  });

  it("clamps a value below minimum to 0.5", () => {
    vi.stubEnv("LEGENDARY_RATE_MULTIPLIER", "0.1");
    expect(getFlags().legendaryRateMultiplier).toBe(0.5);
  });

  it("clamps a value above maximum to 4.0", () => {
    vi.stubEnv("LEGENDARY_RATE_MULTIPLIER", "99");
    expect(getFlags().legendaryRateMultiplier).toBe(4.0);
  });

  it("falls back to default 1.0 for NaN input", () => {
    vi.stubEnv("LEGENDARY_RATE_MULTIPLIER", "not-a-number");
    expect(getFlags().legendaryRateMultiplier).toBe(1.0);
  });

  it("falls back to default 1.0 for empty string", () => {
    vi.stubEnv("LEGENDARY_RATE_MULTIPLIER", "");
    expect(getFlags().legendaryRateMultiplier).toBe(1.0);
  });

  it("clamps -0 to the minimum (0.5) since -0 < min", () => {
    vi.stubEnv("LEGENDARY_RATE_MULTIPLIER", "-0");
    expect(getFlags().legendaryRateMultiplier).toBe(0.5);
  });
});

describe("unavailableResponse", () => {
  it("returns HTTP 503", async () => {
    const res = unavailableResponse("Fortunes");
    expect(res.status).toBe(503);
  });

  it("returns error code 'temporarily_unavailable'", async () => {
    const res = unavailableResponse("Fortunes");
    const body = await res.json();
    expect(body.error.code).toBe("temporarily_unavailable");
  });

  it("includes the feature name in the message", async () => {
    const res = unavailableResponse("Fortune Packs");
    const body = await res.json();
    expect(body.error.message).toContain("Fortune Packs");
  });
});
