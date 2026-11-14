import { describe, it, expect } from "vitest";
import {
  buildFortuneUrl,
  truncateForX,
  buildXShareUrl,
  buildShareText,
  SHARE_VARIANTS,
  PACK_SHARE_VARIANTS,
  SITE_URL,
} from "@/lib/share";

const LIMIT = 275;

/* ─── buildFortuneUrl ──────────────────────────────────── */

describe("buildFortuneUrl", () => {
  it("returns a URL starting with the site URL + /fortune/", () => {
    const url = buildFortuneUrl("Trusted third parties are security holes.", "legendary");
    expect(url).toMatch(/^https:\/\/fortunesats\.com\/fortune\//);
  });

  it("appends a non-empty slug", () => {
    const url = buildFortuneUrl("test fortune", "common");
    const slug = url.replace(`${SITE_URL}/fortune/`, "");
    expect(slug.length).toBeGreaterThan(5);
  });

  it("returns site URL when rarity is any valid value", () => {
    for (const r of ["legendary", "epic", "rare", "common"] as const) {
      const url = buildFortuneUrl("fortune text", r);
      expect(url.startsWith(SITE_URL)).toBe(true);
    }
  });
});

/* ─── truncateForX ─────────────────────────────────────── */

describe("truncateForX", () => {
  // Passthrough template — fortune text IS the full tweet body
  const PASS = (f: string) => f;

  it("returns fortune unchanged when it fits within the limit", () => {
    const fortune = "A short fortune.";
    expect(truncateForX(fortune, PASS)).toBe(fortune);
  });

  it("returns fortune unchanged when effective length equals exactly the limit", () => {
    const fortune = "x".repeat(LIMIT);
    expect(truncateForX(fortune, PASS)).toBe(fortune);
  });

  it("truncates and appends ellipsis when fortune exceeds the limit", () => {
    const fortune = "x".repeat(LIMIT + 30);
    const result = truncateForX(fortune, PASS);
    expect(result.endsWith("…")).toBe(true);
    expect(result.length).toBeLessThan(fortune.length);
  });

  it("truncates at a word boundary when one is available past 60% of max", () => {
    // "word " repeated 60× = 300 chars, all word boundaries
    const fortune = "word ".repeat(60).trimEnd();
    const result = truncateForX(fortune, PASS);
    // After truncation the text before "…" should be clean words
    const body = result.replace(/…$/, "");
    expect(body.trimEnd()).toBe(body); // no trailing space before ellipsis
    // Every segment is a valid word (no mid-word cuts)
    const words = body.split(" ");
    for (const w of words) {
      expect(w).toBe("word");
    }
  });

  it("falls back to character-level cut when no usable word boundary exists", () => {
    // Solid string of 'x' — no spaces, so lastIndexOf(" ") === -1
    const fortune = "x".repeat(LIMIT + 30);
    const result = truncateForX(fortune, PASS);
    expect(result.endsWith("…")).toBe(true);
    // Cut length = LIMIT + 30 - (30) - 1 = LIMIT - 1
    const body = result.replace(/…$/, "");
    expect(body.length).toBe(LIMIT - 1);
  });

  it("counts URLs in the template as 23 chars (t.co shortening)", () => {
    // Template: fortune + space + a very long URL
    const longUrl = "https://fortunesats.com/" + "a".repeat(200);
    const template = (f: string) => `${f} ${longUrl}`;
    const fortune = "x".repeat(240);

    // Effective length = 240 + 1 + 23 = 264 ≤ 275 → no truncation
    expect(truncateForX(fortune, template)).toBe(fortune);

    // Now push it over: 252 + 1 + 23 = 276 → must truncate
    const longFortune = "x".repeat(252);
    const result = truncateForX(longFortune, template);
    expect(result.endsWith("…")).toBe(true);
    expect(result.length).toBeLessThan(longFortune.length);
  });

  it("doesn't count template's URL length literally when measuring", () => {
    // Contrast: without t.co accounting this fortune would look too long
    const veryLongUrl = "https://example.com/" + "z".repeat(300);
    const template = (f: string) => `${f} ${veryLongUrl}`;

    // If we counted the URL literally, effective would be 10 + 1 + 321 = 332 (over limit)
    // With t.co shortening: 10 + 1 + 23 = 34 (well within limit)
    const shortFortune = "x".repeat(10);
    expect(truncateForX(shortFortune, template)).toBe(shortFortune);
  });

  it("falls back to 50-char slice when maxLen < 20 (template overhead dominates)", () => {
    // Template adds 300 chars of static overhead
    const heavyTemplate = (f: string) => f + "x".repeat(300);
    const fortune = "short fortune here today";
    // effective = 24 + 300 = 324; excess = 324 - 275 = 49; maxLen = 24 - 49 - 1 = -26 < 20
    const result = truncateForX(fortune, heavyTemplate);
    expect(result.endsWith("…")).toBe(true);
    // Falls back to fortune.slice(0, 50) + "…" — fortune is 24 chars so full text + "…"
    expect(result).toBe(fortune + "…");
  });

  it("passes rarity through to template", () => {
    let capturedRarity: string | undefined;
    const template = (f: string, r?: string) => {
      capturedRarity = r;
      return f;
    };
    truncateForX("test", template as never, "legendary");
    expect(capturedRarity).toBe("legendary");
  });
});

/* ─── buildXShareUrl ───────────────────────────────────── */

describe("buildXShareUrl", () => {
  const V0 = SHARE_VARIANTS[0];

  it("returns a valid X intent URL", () => {
    const url = buildXShareUrl("Test fortune", V0, "common");
    expect(url).toMatch(/^https:\/\/x\.com\/intent\/post\?text=/);
  });

  it("URL-encodes the share text (no raw spaces)", () => {
    const url = buildXShareUrl("Fortune with spaces", V0, "common");
    // After `?text=` there should be no unencoded spaces
    const query = url.split("?text=")[1];
    expect(query).not.toContain(" ");
  });

  it("includes the fortune text in the encoded URL", () => {
    const fortune = "uniquemarker12345";
    const url = buildXShareUrl(fortune, V0, "common");
    expect(decodeURIComponent(url)).toContain(fortune);
  });
});

/* ─── buildShareText ───────────────────────────────────── */

describe("buildShareText", () => {
  it("returns the variant template output with the fortune", () => {
    const text = buildShareText("My fortune text", SHARE_VARIANTS[0], "common");
    expect(text).toContain("My fortune text");
  });

  it("includes 100 sats for the classic variant", () => {
    const text = buildShareText("Fortune", SHARE_VARIANTS[0], "common");
    expect(text).toContain("100 sats");
  });
});

/* ─── SHARE_VARIANTS ───────────────────────────────────── */

describe("SHARE_VARIANTS", () => {
  const FORTUNE = "An unforgettable fortune text right here";

  it("has exactly 4 variants", () => {
    expect(SHARE_VARIANTS).toHaveLength(4);
  });

  it("every variant includes the fortune text", () => {
    for (const v of SHARE_VARIANTS) {
      expect(v.template(FORTUNE, "common")).toContain(FORTUNE);
    }
  });

  it("legendary variants include LEGENDARY label", () => {
    for (const v of SHARE_VARIANTS) {
      expect(v.template(FORTUNE, "legendary")).toContain("LEGENDARY");
    }
  });

  it("epic variants include EPIC label", () => {
    for (const v of SHARE_VARIANTS) {
      expect(v.template(FORTUNE, "epic")).toContain("EPIC");
    }
  });

  it("common variants do not include a rarity label", () => {
    for (const v of SHARE_VARIANTS) {
      expect(v.template(FORTUNE, "common")).not.toMatch(/\[COMMON\]|\bCOMMON\b/);
    }
  });

  it("every variant links back to fortunesats.com", () => {
    for (const v of SHARE_VARIANTS) {
      expect(v.template(FORTUNE, "common")).toContain("fortunesats.com");
    }
  });

  it("fortune with attribution uses author format", () => {
    const withAuthor = "The obstacle is the way. - Marcus Aurelius";
    const text = SHARE_VARIANTS[0].template(withAuthor, "common");
    expect(text).toContain("Marcus Aurelius");
    expect(text).toContain('"The obstacle is the way."');
  });

  it("fortune without attribution is quoted whole", () => {
    const plain = "Stay humble, stack sats.";
    const text = SHARE_VARIANTS[0].template(plain, "common");
    expect(text).toContain(`"${plain}"`);
  });
});

/* ─── PACK_SHARE_VARIANTS ──────────────────────────────── */

describe("PACK_SHARE_VARIANTS", () => {
  const FORTUNE = "Pack fortune text here";

  it("has exactly 4 variants", () => {
    expect(PACK_SHARE_VARIANTS).toHaveLength(4);
  });

  it("every variant includes the fortune text", () => {
    for (const v of PACK_SHARE_VARIANTS) {
      expect(v.template(FORTUNE, "epic")).toContain(FORTUNE);
    }
  });

  it("legendary pack variants include LEGENDARY label", () => {
    for (const v of PACK_SHARE_VARIANTS) {
      expect(v.template(FORTUNE, "legendary")).toContain("LEGENDARY");
    }
  });

  it("every pack variant links back to fortunesats.com", () => {
    for (const v of PACK_SHARE_VARIANTS) {
      expect(v.template(FORTUNE, "rare")).toContain("fortunesats.com");
    }
  });
});
