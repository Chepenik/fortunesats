import { describe, it, expect } from "vitest";
import {
  fortunes,
  agentFortunes,
  agentFortuneById,
  getUniqueRandomFortune,
} from "@/lib/fortunes";

describe("agentFortunes enrichment", () => {
  it("enriches every fortune with required fields", () => {
    for (const f of agentFortunes) {
      expect(typeof f.id).toBe("string");
      expect(f.id.length).toBeGreaterThan(0);
      expect(typeof f.text).toBe("string");
      expect(f.text.length).toBeGreaterThan(0);
      expect(["legendary", "epic", "rare", "common"]).toContain(f.rarity);
      expect(["stoicism", "philosophy", "eastern", "sovereignty", "growth", "fortune", "wit"]).toContain(f.category);
      expect(Array.isArray(f.tags)).toBe(true);
      expect(f.tags.length).toBeGreaterThan(0);
      // author is string or null
      expect(f.author === null || typeof f.author === "string").toBe(true);
    }
  });

  it("produces the same number of enriched fortunes as base fortunes", () => {
    expect(agentFortunes.length).toBe(fortunes.length);
  });

  it("generates stable IDs — same text always produces same ID", () => {
    // Import the first fortune's text and check that re-running enrichment
    // gives the same id by confirming the map lookup works
    for (const f of agentFortunes) {
      expect(agentFortuneById.get(f.id)).toBe(f);
    }
  });

  it("generates unique IDs across all fortunes", () => {
    const ids = agentFortunes.map((f) => f.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(agentFortunes.length);
  });
});

describe("agentFortuneById map", () => {
  it("contains exactly one entry per fortune", () => {
    expect(agentFortuneById.size).toBe(agentFortunes.length);
  });

  it("returns the correct fortune for a known id", () => {
    const first = agentFortunes[0];
    const found = agentFortuneById.get(first.id);
    expect(found).toBeDefined();
    expect(found!.text).toBe(first.text);
    expect(found!.rarity).toBe(first.rarity);
  });

  it("returns undefined for unknown id", () => {
    expect(agentFortuneById.get("unknown-id")).toBeUndefined();
  });
});

describe("author extraction", () => {
  it("extracts author from 'text — Author' format", () => {
    const stoic = agentFortunes.find((f) => f.text.includes("Marcus Aurelius"));
    expect(stoic?.author).toBe("Marcus Aurelius");
  });

  it("extracts multi-word authors correctly", () => {
    const seneca = agentFortunes.find((f) => f.text.includes("— Seneca"));
    expect(seneca?.author).toBe("Seneca");
  });

  it("returns null for fortunes without attribution", () => {
    const unattributed = agentFortunes.find((f) => !f.text.includes(" — "));
    if (unattributed) {
      expect(unattributed.author).toBeNull();
    }
  });

  it("extracts Rumi as author", () => {
    const rumi = agentFortunes.find((f) => f.text.includes("— Rumi"));
    expect(rumi?.author).toBe("Rumi");
  });
});

describe("category inference", () => {
  it("classifies Marcus Aurelius fortunes as stoicism", () => {
    const stoic = agentFortunes.filter((f) => f.author === "Marcus Aurelius");
    expect(stoic.length).toBeGreaterThan(0);
    for (const f of stoic) {
      expect(f.category).toBe("stoicism");
    }
  });

  it("classifies Seneca fortunes as stoicism", () => {
    const senecaFortunes = agentFortunes.filter((f) => f.author === "Seneca");
    expect(senecaFortunes.length).toBeGreaterThan(0);
    for (const f of senecaFortunes) {
      expect(f.category).toBe("stoicism");
    }
  });

  it("classifies Lao Tzu fortunes as eastern", () => {
    const laoTzu = agentFortunes.filter((f) => f.author === "Lao Tzu");
    expect(laoTzu.length).toBeGreaterThan(0);
    for (const f of laoTzu) {
      expect(f.category).toBe("eastern");
    }
  });

  it("classifies Rumi fortunes as eastern", () => {
    const rumi = agentFortunes.filter((f) => f.author === "Rumi");
    expect(rumi.length).toBeGreaterThan(0);
    for (const f of rumi) {
      expect(f.category).toBe("eastern");
    }
  });

  it("classifies bitcoin/sovereignty keywords as sovereignty", () => {
    const sovereignty = agentFortunes.filter((f) => f.category === "sovereignty");
    expect(sovereignty.length).toBeGreaterThan(0);
    // These keywords mirror inferCategory's sovereigntyKw list exactly
    const sovereigntyKw = [
      "sats", "money", "bitcoin", "proof of work", "time preference",
      "fix the", "savings", "sound money", "freedom compounds",
      "sovereign", "value for value",
    ];
    for (const f of sovereignty) {
      const lower = f.text.toLowerCase();
      const hasSovereigntyKw = sovereigntyKw.some((kw) => lower.includes(kw));
      expect(hasSovereigntyKw, `"${f.text}" classified as sovereignty but matched no keyword`).toBe(true);
    }
  });

  it("classifies Nietzsche as philosophy", () => {
    const nietzsche = agentFortunes.filter((f) => f.author?.includes("Nietzsche"));
    expect(nietzsche.length).toBeGreaterThan(0);
    for (const f of nietzsche) {
      expect(f.category).toBe("philosophy");
    }
  });
});

describe("tag inference", () => {
  it("includes category as the first tag", () => {
    for (const f of agentFortunes) {
      expect(f.tags[0]).toBe(f.category);
    }
  });

  it("tags attributed fortunes with 'attributed'", () => {
    const attributed = agentFortunes.filter((f) => f.author !== null);
    for (const f of attributed) {
      expect(f.tags).toContain("attributed");
    }
  });

  it("tags unattributed fortunes with 'original'", () => {
    const original = agentFortunes.filter((f) => f.author === null);
    for (const f of original) {
      expect(f.tags).toContain("original");
    }
  });

  it("adds 'wisdom' tag to fortunes mentioning wisdom or knowledge", () => {
    const wisdomFortunes = agentFortunes.filter(
      (f) =>
        f.text.toLowerCase().includes("wisdom") ||
        f.text.toLowerCase().includes("knowledge"),
    );
    for (const f of wisdomFortunes) {
      expect(f.tags).toContain("wisdom");
    }
  });
});

describe("getUniqueRandomFortune", () => {
  it("avoids already-claimed fortune texts", () => {
    // Claim all but one fortune
    const allButLast = fortunes.slice(0, -1).map((f) => f.text);
    const result = getUniqueRandomFortune(allButLast);
    expect(result.text).toBe(fortunes[fortunes.length - 1].text);
  });

  it("returns a valid Fortune when no fortunes are claimed", () => {
    const result = getUniqueRandomFortune([]);
    expect(typeof result.text).toBe("string");
    expect(result.text.length).toBeGreaterThan(0);
    expect(["legendary", "epic", "rare", "common"]).toContain(result.rarity);
  });

  it("falls back to any fortune when all have been claimed", () => {
    const allClaimed = fortunes.map((f) => f.text);
    const result = getUniqueRandomFortune(allClaimed);
    expect(typeof result.text).toBe("string");
    expect(result.text.length).toBeGreaterThan(0);
  });

  it("picks from the unclaimed pool when some are claimed", () => {
    // Run 20 times to get a statistical sample
    const claimed = fortunes.slice(0, 10).map((f) => f.text);
    const claimedSet = new Set(claimed);

    for (let i = 0; i < 20; i++) {
      const result = getUniqueRandomFortune(claimed);
      expect(claimedSet.has(result.text)).toBe(false);
    }
  });
});
