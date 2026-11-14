import { describe, it, expect } from "vitest";
import { encodeFortuneSlug, decodeFortuneSlug, parseFortune, getQuoteFontSize } from "@/lib/og";

describe("fortune slug encoding/decoding", () => {
  it("roundtrips text and rarity correctly", () => {
    const text = "Trusted third parties are security holes. - Nick Szabo";
    const rarity = "legendary" as const;
    const slug = encodeFortuneSlug(text, rarity);
    const decoded = decodeFortuneSlug(slug);
    expect(decoded).toEqual({ text, rarity });
  });

  it("returns null for corrupted slugs", () => {
    expect(decodeFortuneSlug("not-valid-base64!!!")).toBeNull();
  });

  it("returns null for invalid rarity", () => {
    // Manually encode with an invalid rarity
    const json = JSON.stringify({ t: "test", r: "mythic" });
    const bytes = new TextEncoder().encode(json);
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    const slug = btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    expect(decodeFortuneSlug(slug)).toBeNull();
  });
});

describe("parseFortune", () => {
  it("splits a hyphen-attributed fortune into quote and author", () => {
    const result = parseFortune("Trusted third parties are security holes. - Nick Szabo");
    expect(result.quote).toBe("Trusted third parties are security holes.");
    expect(result.author).toBe("Nick Szabo");
  });

  it("supports em-dash attribution", () => {
    const result = parseFortune("The obstacle is the way. — Marcus Aurelius");
    expect(result.quote).toBe("The obstacle is the way.");
    expect(result.author).toBe("Marcus Aurelius");
  });

  it("supports en-dash attribution", () => {
    const result = parseFortune("Stay humble. Stack sats. – Anon");
    expect(result.quote).toBe("Stay humble. Stack sats.");
    expect(result.author).toBe("Anon");
  });

  it("returns null author when no attribution present", () => {
    const result = parseFortune("Don't trust, verify.");
    expect(result.quote).toBe("Don't trust, verify.");
    expect(result.author).toBeNull();
  });

  it("ignores lowercase after dash — author must start with uppercase", () => {
    const result = parseFortune("All fiat is a scam - unknown");
    expect(result.author).toBeNull();
  });

  it("handles multiple dashes by attributing the first valid split point", () => {
    // Non-greedy (.+?) stops at the first dash where the remainder starts with [A-Z]
    const result = parseFortune("Satoshi - Nakamoto - Bitcoin");
    expect(result.quote).toBe("Satoshi");
    expect(result.author).toBe("Nakamoto - Bitcoin");
  });

  it("trims surrounding whitespace from the quote", () => {
    const result = parseFortune("  Stack sats.  - Satoshi  ");
    expect(result.quote).toBe("Stack sats.");
    expect(result.author).toBe("Satoshi");
  });
});

describe("getQuoteFontSize", () => {
  it("returns 44 for very short text (≤60 chars)", () => {
    expect(getQuoteFontSize("Short.")).toBe(44);
    expect(getQuoteFontSize("a".repeat(60))).toBe(44);
  });

  it("returns 38 for medium-short text (61–90 chars)", () => {
    expect(getQuoteFontSize("a".repeat(61))).toBe(38);
    expect(getQuoteFontSize("a".repeat(90))).toBe(38);
  });

  it("returns 32 for medium text (91–120 chars)", () => {
    expect(getQuoteFontSize("a".repeat(91))).toBe(32);
    expect(getQuoteFontSize("a".repeat(120))).toBe(32);
  });

  it("returns 28 for medium-long text (121–160 chars)", () => {
    expect(getQuoteFontSize("a".repeat(121))).toBe(28);
    expect(getQuoteFontSize("a".repeat(160))).toBe(28);
  });

  it("returns 24 for long text (>160 chars)", () => {
    expect(getQuoteFontSize("a".repeat(161))).toBe(24);
    expect(getQuoteFontSize("a".repeat(300))).toBe(24);
  });
});
