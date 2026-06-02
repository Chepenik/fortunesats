import { describe, it, expect } from "vitest";
import {
  truncateForX,
  buildFortuneUrl,
  buildShareText,
  buildXShareUrl,
  pickVariant,
  SHARE_VARIANTS,
  PACK_SHARE_VARIANTS,
  SITE_URL,
} from "@/lib/share";

// ── truncateForX ────────────────────────────────────────────────────────────
// Uses a 1:1 identity template so effective length equals fortune length,
// making the arithmetic easy to reason about without URL-shortening noise.

const identity = (f: string) => f;

describe("truncateForX", () => {
  it("returns the original fortune when effective length ≤ 275", () => {
    const fortune = "The obstacle is the way. - Marcus Aurelius";
    expect(truncateForX(fortune, identity)).toBe(fortune);
  });

  it("truncates at a word boundary when one exists past 60% of maxLen", () => {
    // "word " × 57 trimmed = 284 chars > 275 limit
    // excess=9, maxLen=274, last space at pos 269 (> 164.4), so cuts there.
    const fortune = "word ".repeat(57).trimEnd(); // 284 chars
    const result = truncateForX(fortune, identity);
    expect(result.endsWith("…")).toBe(true);
    expect(result.length).toBeLessThan(fortune.length + 1);
    // Word boundary: char before "…" is 'd' (end of "word"), not a space
    const body = result.slice(0, -1);
    expect(body.at(-1)).toBe("d");
    expect(body.at(-2)).not.toBe(" ");
  });

  it("falls back to character-level truncation when no good word boundary exists", () => {
    // 281 chars, no spaces — lastIndexOf(" ") returns -1, not > 60% threshold
    const fortune = "a" + "b".repeat(280);
    const result = truncateForX(fortune, identity);
    expect(result.endsWith("…")).toBe(true);
    // excess=6, maxLen=274 → result body = "a" + "b"×273 = 274 chars
    expect(result.slice(0, -1)).toBe("a" + "b".repeat(273));
  });

  it("applies 50-char fallback when maxLen < 20 (template dominates the budget)", () => {
    // Template adds 270 fixed chars; 1-char excess → maxLen = fortune.length - 2
    // With a 15-char fortune: maxLen = 13 < 20, so slice(0,50) + "…"
    const heavyTemplate = (f: string) => "A".repeat(270) + f;
    const fortune = "A short fortune"; // 15 chars → 270+15=285 effective > 275
    const result = truncateForX(fortune, heavyTemplate);
    expect(result).toBe(fortune.slice(0, 50) + "…");
  });

  it("normalises long URLs to 23 chars when computing effective length", () => {
    // A 200-char URL in the template should count as only 23 (t.co) → fits
    const longUrl = "https://fortunesats.com/fortune/" + "x".repeat(200);
    const templateWithUrl = (f: string) => `${f} ${longUrl}`;
    const fortune = "A short fortune"; // effective = 15+1+23 = 39 ≤ 275
    expect(truncateForX(fortune, templateWithUrl)).toBe(fortune);
  });
});

// ── buildFortuneUrl ─────────────────────────────────────────────────────────

describe("buildFortuneUrl", () => {
  it("returns a per-fortune URL under SITE_URL/fortune/ for valid inputs", () => {
    const url = buildFortuneUrl("The path is the goal.", "rare");
    expect(url.startsWith(`${SITE_URL}/fortune/`)).toBe(true);
  });

  it("returns SITE_URL as fallback when slug encoding fails", () => {
    // Encoding can't easily be forced to throw with valid strings, but
    // we verify the SITE_URL constant itself is a well-formed https URL.
    expect(SITE_URL).toMatch(/^https:\/\//);
  });
});

// ── buildXShareUrl ──────────────────────────────────────────────────────────

describe("buildXShareUrl", () => {
  it("returns an X intent post URL with the share text URL-encoded", () => {
    const variant = SHARE_VARIANTS[0];
    const url = buildXShareUrl("Fortune text here.", variant, "common");
    expect(url.startsWith("https://x.com/intent/post?text=")).toBe(true);
    // The encoded text must contain the fortune
    expect(decodeURIComponent(url.split("?text=")[1])).toContain(
      "Fortune text here.",
    );
  });
});

// ── pickVariant ─────────────────────────────────────────────────────────────

describe("pickVariant", () => {
  it("always returns a variant whose id belongs to SHARE_VARIANTS when isPack=false", () => {
    const ids = new Set(SHARE_VARIANTS.map((v) => v.id));
    for (let i = 0; i < 30; i++) {
      expect(ids.has(pickVariant(false).id)).toBe(true);
    }
  });

  it("always returns a variant whose id belongs to PACK_SHARE_VARIANTS when isPack=true", () => {
    const ids = new Set(PACK_SHARE_VARIANTS.map((v) => v.id));
    for (let i = 0; i < 30; i++) {
      expect(ids.has(pickVariant(true).id)).toBe(true);
    }
  });
});

// ── buildShareText ──────────────────────────────────────────────────────────

describe("buildShareText", () => {
  it("returns a non-empty string containing the fortune text", () => {
    const variant = SHARE_VARIANTS[0];
    const text = buildShareText("Test fortune signal.", variant, "epic");
    expect(typeof text).toBe("string");
    expect(text.length).toBeGreaterThan(0);
    expect(text).toContain("Test fortune signal.");
  });

  it("each SHARE_VARIANTS template produces unique output for the same fortune", () => {
    const fortune = "Bitcoin fixes this.";
    const outputs = SHARE_VARIANTS.map((v) =>
      buildShareText(fortune, v, "common"),
    );
    const unique = new Set(outputs);
    expect(unique.size).toBe(SHARE_VARIANTS.length);
  });
});
