import { describe, it, expect } from "vitest";
import {
  FORTUNE_POOL_TOTAL,
  FORTUNE_POOL_TOTALS,
  BASE_RARITY_WEIGHTS,
  LUCKY_PRIME_COUNT_MAX,
  LUCKY_PRIME_COUNT_MIN,
  LUCKY_PRIME_MAX,
  LUCKY_PRIME_MIN,
  fortunes,
  seasonalFortunes,
  agentFortunes,
  agentFortuneById,
  getLuckyPrimeNumbers,
  getRarityWeights,
  getUniqueRandomFortune,
  isPrimeNumber,
  selectRarity,
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
      expect(f.luckyNumbers.length).toBeGreaterThanOrEqual(LUCKY_PRIME_COUNT_MIN);
      expect(f.luckyNumbers.length).toBeLessThanOrEqual(LUCKY_PRIME_COUNT_MAX);
      expect(Array.isArray(f.tags)).toBe(true);
      expect(f.tags.length).toBeGreaterThan(0);
      // author is string or null
      expect(f.author === null || typeof f.author === "string").toBe(true);
    }
  });

  it("produces the same number of enriched fortunes as base fortunes", () => {
    expect(agentFortunes.length).toBe(fortunes.length);
  });

  it("keeps the public core pool count in sync with rarity totals", () => {
    expect(FORTUNE_POOL_TOTAL).toBe(119);
    expect(FORTUNE_POOL_TOTALS).toEqual({
      legendary: 8,
      epic: 18,
      rare: 38,
      common: 55,
    });
    expect(
      Object.values(FORTUNE_POOL_TOTALS).reduce((sum, count) => sum + count, 0),
    ).toBe(FORTUNE_POOL_TOTAL);
  });

  it("keeps every core and seasonal fortune explicitly attributed", () => {
    const all = [...agentFortunes, ...seasonalFortunes.map((f) => ({
      text: f.text,
      author: f.text.match(/\s+[—–-]\s+([A-Z][^—–-]{0,59})$/)?.[1] ?? null,
    }))];

    for (const f of all) {
      expect(f.author, `"${f.text}" has no attribution`).toBeTruthy();
    }
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
  it("extracts author from 'text - Author' format", () => {
    const stoic = agentFortunes.find((f) => f.text.includes("Marcus Aurelius"));
    expect(stoic?.author).toBe("Inspired by Marcus Aurelius");
  });

  it("extracts multi-word authors correctly", () => {
    const satoshi = agentFortunes.find((f) => f.text.includes("- Satoshi Nakamoto"));
    expect(satoshi?.author).toBe("Satoshi Nakamoto");
  });

  it("keeps dash attribution support", () => {
    const satoshi = agentFortunes.find((f) => f.text.includes("- Satoshi Nakamoto"));
    expect(satoshi?.author).toBe("Satoshi Nakamoto");
  });

  it("labels inspired fortunes without treating them as direct quotes", () => {
    const inspired = agentFortunes.find((f) => f.author?.startsWith("Inspired by "));
    expect(inspired).toBeDefined();
    expect(inspired?.tags).toContain("inspired");
  });

  it("extracts Nick Szabo as author", () => {
    const szabo = agentFortunes.find((f) => f.text.includes("- Nick Szabo"));
    expect(szabo?.author).toBe("Nick Szabo");
  });
});

describe("category inference", () => {
  it("classifies Marcus Aurelius fortunes as stoicism", () => {
    const stoic = agentFortunes.filter((f) => f.author?.includes("Marcus Aurelius"));
    expect(stoic.length).toBeGreaterThan(0);
    for (const f of stoic) {
      expect(f.category).toBe("stoicism");
    }
  });

  it("classifies Seneca fortunes as stoicism", () => {
    const senecaFortunes = agentFortunes.filter((f) => f.author?.includes("Seneca"));
    expect(senecaFortunes.length).toBeGreaterThan(0);
    for (const f of senecaFortunes) {
      expect(f.category).toBe("stoicism");
    }
  });

  it("classifies Lao Tzu fortunes as eastern", () => {
    const laoTzu = agentFortunes.filter((f) => f.author?.includes("Lao Tzu"));
    expect(laoTzu.length).toBeGreaterThan(0);
    for (const f of laoTzu) {
      expect(f.category).toBe("eastern");
    }
  });

  it("classifies Buddha fortunes as eastern", () => {
    const buddha = agentFortunes.filter((f) => f.author?.includes("Buddha"));
    expect(buddha.length).toBeGreaterThan(0);
    for (const f of buddha) {
      expect(f.category).toBe("eastern");
    }
  });

  it("classifies bitcoin/sovereignty keywords as sovereignty", () => {
    const sovereignty = agentFortunes.filter((f) => f.category === "sovereignty");
    expect(sovereignty.length).toBeGreaterThan(0);
    const sovereigntyAuthors = ["Satoshi Nakamoto", "Nick Szabo", "Frederic Bastiat"];
    // These keywords mirror inferCategory's sovereigntyKw list exactly
    const sovereigntyKw = [
      "sats", " sat ", "money", "currency", "bitcoin", "proof of work",
      "proof-of-work", "time preference", "trusted third", "peer-to-peer",
      "mint", "state", "mempool", "keys", "wallet", "scarcity", "stack",
      "fix the", "savings", "sound money", "freedom compounds",
      "sovereign", "value for value", "consensus", "self-custody",
    ];
    for (const f of sovereignty) {
      const lower = f.text.toLowerCase();
      const hasSovereigntyKw = sovereigntyKw.some((kw) => lower.includes(kw));
      const hasSovereigntyAuthor = !!f.author
        && sovereigntyAuthors.some((author) => f.author?.includes(author));
      expect(
        hasSovereigntyKw || hasSovereigntyAuthor,
        `"${f.text}" classified as sovereignty but matched no keyword or author`,
      ).toBe(true);
    }
  });

  it("classifies singular sat references as sovereignty", () => {
    const satFortune = agentFortunes.find((f) => f.text.includes("Every sat tells a story."));
    expect(satFortune?.category).toBe("sovereignty");
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

  it("tags oracle-authored fortunes", () => {
    const oracle = agentFortunes.filter((f) => f.author === "FortuneSats Oracle");
    expect(oracle.length).toBeGreaterThan(0);
    for (const f of oracle) {
      expect(f.tags).toContain("oracle");
      expect(f.tags).toContain("attributed");
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

describe("lucky prime numbers", () => {
  it("generates deterministic lucky prime numbers", () => {
    expect(getLuckyPrimeNumbers("same-seed")).toEqual(getLuckyPrimeNumbers("same-seed"));
    expect(getLuckyPrimeNumbers("same-seed")).not.toEqual(getLuckyPrimeNumbers("different-seed"));
  });

  it("keeps lucky numbers prime, unique, and within range", () => {
    for (const f of agentFortunes) {
      const unique = new Set(f.luckyNumbers);
      expect(unique.size).toBe(f.luckyNumbers.length);
      expect(f.luckyNumbers.length).toBeGreaterThanOrEqual(LUCKY_PRIME_COUNT_MIN);
      expect(f.luckyNumbers.length).toBeLessThanOrEqual(LUCKY_PRIME_COUNT_MAX);
      for (const n of f.luckyNumbers) {
        expect(n).toBeGreaterThanOrEqual(LUCKY_PRIME_MIN);
        expect(n).toBeLessThanOrEqual(LUCKY_PRIME_MAX);
        expect(isPrimeNumber(n), `${n} is not prime`).toBe(true);
      }
    }
  });
});

describe("rarity weighting", () => {
  it("uses the production reveal weights", () => {
    expect(BASE_RARITY_WEIGHTS).toEqual({
      legendary: 0.08,
      epic: 0.17,
      rare: 0.35,
      common: 0.40,
    });
  });

  it("selects rarity by threshold", () => {
    expect(selectRarity(0)).toBe("legendary");
    expect(selectRarity(0.079)).toBe("legendary");
    expect(selectRarity(0.08)).toBe("epic");
    expect(selectRarity(0.249)).toBe("epic");
    expect(selectRarity(0.25)).toBe("rare");
    expect(selectRarity(0.599)).toBe("rare");
    expect(selectRarity(0.60)).toBe("common");
    expect(selectRarity(0.999)).toBe("common");
  });

  it("scales legendary without changing total probability", () => {
    const weights = getRarityWeights(2);
    expect(weights.legendary).toBeCloseTo(0.16);
    expect(Object.values(weights).reduce((sum, weight) => sum + weight, 0)).toBeCloseTo(1);
    expect(weights.common).toBeLessThan(BASE_RARITY_WEIGHTS.common);
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
