/**
 * Tests for the feature flags module.
 *
 * flags.ts is the single source of truth for feature gating and
 * numeric config (legendary rate, etc.). Regressions here can
 * silently disable payment flows or misconfigure drop rates.
 *
 * All tests manipulate process.env directly and restore it afterward —
 * no mocks needed since the module has no external dependencies.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getFlags, unavailableResponse } from "@/lib/flags";

/* ─── env helpers ────────────────────────────────────────── */

const MANAGED_KEYS = [
  "FORTUNE_SINGLE_ENABLED",
  "FORTUNE_PACK_ENABLED",
  "LEADERBOARD_ENABLED",
  "ACTIVITY_FEED_ENABLED",
  "FREE_FORTUNE_PROMO",
  "LEGENDARY_RATE_MULTIPLIER",
  "SEASONAL_POOL_ENABLED",
  "GIFT_ENABLED",
];

let saved: Record<string, string | undefined> = {};

beforeEach(() => {
  saved = {};
  for (const key of MANAGED_KEYS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of MANAGED_KEYS) {
    if (saved[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = saved[key];
    }
  }
});

/* ═══════════════════════════════════════════════════════════
   Default values (no env vars set)
   ═══════════════════════════════════════════════════════════ */

describe("getFlags — defaults", () => {
  it("enables fortune single by default", () => {
    expect(getFlags().fortuneSingleEnabled).toBe(true);
  });

  it("enables fortune packs by default", () => {
    expect(getFlags().fortunePackEnabled).toBe(true);
  });

  it("enables leaderboard by default", () => {
    expect(getFlags().leaderboardEnabled).toBe(true);
  });

  it("enables activity feed by default", () => {
    expect(getFlags().activityFeedEnabled).toBe(true);
  });

  it("disables free fortune promo by default", () => {
    expect(getFlags().freeFortunePromo).toBe(false);
  });

  it("sets legendaryRateMultiplier to 1.0 by default", () => {
    expect(getFlags().legendaryRateMultiplier).toBe(1.0);
  });

  it("disables seasonal pool by default", () => {
    expect(getFlags().seasonalPoolEnabled).toBe(false);
  });

  it("enables gift fortunes by default", () => {
    expect(getFlags().giftEnabled).toBe(true);
  });
});

/* ═══════════════════════════════════════════════════════════
   Boolean flag parsing
   ═══════════════════════════════════════════════════════════ */

describe("boolean flag parsing", () => {
  it('accepts "true" string', () => {
    process.env.FORTUNE_SINGLE_ENABLED = "true";
    expect(getFlags().fortuneSingleEnabled).toBe(true);
  });

  it('accepts "1" as true', () => {
    process.env.FORTUNE_SINGLE_ENABLED = "1";
    expect(getFlags().fortuneSingleEnabled).toBe(true);
  });

  it('accepts "false" string', () => {
    process.env.FORTUNE_SINGLE_ENABLED = "false";
    expect(getFlags().fortuneSingleEnabled).toBe(false);
  });

  it('treats any other string as false', () => {
    process.env.FORTUNE_SINGLE_ENABLED = "yes";
    expect(getFlags().fortuneSingleEnabled).toBe(false);
  });

  it("treats empty string as default (true)", () => {
    process.env.FORTUNE_SINGLE_ENABLED = "";
    expect(getFlags().fortuneSingleEnabled).toBe(true);
  });

  it("disabling free promo: false string stays false", () => {
    process.env.FREE_FORTUNE_PROMO = "false";
    expect(getFlags().freeFortunePromo).toBe(false);
  });

  it("enabling free promo: true string works", () => {
    process.env.FREE_FORTUNE_PROMO = "true";
    expect(getFlags().freeFortunePromo).toBe(true);
  });
});

/* ═══════════════════════════════════════════════════════════
   legendaryRateMultiplier — numeric clamping
   ═══════════════════════════════════════════════════════════ */

describe("legendaryRateMultiplier clamping", () => {
  it("accepts a value within range", () => {
    process.env.LEGENDARY_RATE_MULTIPLIER = "2.0";
    expect(getFlags().legendaryRateMultiplier).toBe(2.0);
  });

  it("clamps below minimum (0.5) to 0.5", () => {
    process.env.LEGENDARY_RATE_MULTIPLIER = "0.1";
    expect(getFlags().legendaryRateMultiplier).toBe(0.5);
  });

  it("clamps above maximum (4.0) to 4.0", () => {
    process.env.LEGENDARY_RATE_MULTIPLIER = "10";
    expect(getFlags().legendaryRateMultiplier).toBe(4.0);
  });

  it("clamps negative to minimum 0.5", () => {
    process.env.LEGENDARY_RATE_MULTIPLIER = "-1";
    expect(getFlags().legendaryRateMultiplier).toBe(0.5);
  });

  it("accepts exact boundary values", () => {
    process.env.LEGENDARY_RATE_MULTIPLIER = "0.5";
    expect(getFlags().legendaryRateMultiplier).toBe(0.5);

    process.env.LEGENDARY_RATE_MULTIPLIER = "4.0";
    expect(getFlags().legendaryRateMultiplier).toBe(4.0);
  });

  it("falls back to 1.0 on NaN input", () => {
    process.env.LEGENDARY_RATE_MULTIPLIER = "not-a-number";
    expect(getFlags().legendaryRateMultiplier).toBe(1.0);
  });

  it("falls back to 1.0 on empty string", () => {
    process.env.LEGENDARY_RATE_MULTIPLIER = "";
    expect(getFlags().legendaryRateMultiplier).toBe(1.0);
  });
});

/* ═══════════════════════════════════════════════════════════
   unavailableResponse
   ═══════════════════════════════════════════════════════════ */

describe("unavailableResponse", () => {
  it("returns a 503 Response", () => {
    const res = unavailableResponse("Fortunes");
    expect(res.status).toBe(503);
  });

  it("response body includes the feature name", async () => {
    const res = unavailableResponse("Fortune Packs");
    const body = await res.json() as { error: { code: string; message: string } };
    expect(body.error.code).toBe("temporarily_unavailable");
    expect(body.error.message).toContain("Fortune Packs");
  });

  it("response has JSON content type", () => {
    const res = unavailableResponse("Test");
    expect(res.headers.get("content-type")).toContain("application/json");
  });
});
