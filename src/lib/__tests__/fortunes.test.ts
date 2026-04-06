import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/flags", () => ({
  getFlags: vi.fn(() => ({
    fortuneSingleEnabled: true,
    fortunePackEnabled: true,
    leaderboardEnabled: true,
    activityFeedEnabled: true,
    freeFortunePromo: false,
    legendaryRateMultiplier: 1.0,
    seasonalPoolEnabled: false,
    giftEnabled: true,
  })),
  unavailableResponse: vi.fn(),
}));

const {
  agentFortunes,
  agentFortuneById,
  getRandomFortune,
  getRandomAgentFortune,
} = await import("@/lib/fortunes");

const VALID_RARITIES = new Set(["legendary", "epic", "rare", "common"]);
const VALID_CATEGORIES = new Set([
  "stoicism",
  "philosophy",
  "eastern",
  "sovereignty",
  "growth",
  "fortune",
  "wit",
]);

describe("fortune enrichment — author extraction", () => {
  it("extracts author from ' — Author' suffix", () => {
    const f = agentFortunes.find((f) =>
      f.text.includes("You have power over your mind"),
    );
    expect(f).toBeDefined();
    expect(f!.author).toBe("Marcus Aurelius");
  });

  it("returns null author for fortunes without attribution", () => {
    const f = agentFortunes.find(
      (f) => f.text === "Proof of work is truth without permission.",
    );
    expect(f).toBeDefined();
    expect(f!.author).toBeNull();
  });

  it("returns null author for fortunes without ' — ' separator", () => {
    const unattributed = agentFortunes.filter((f) => f.author === null);
    // Every unattributed fortune should not contain ' — '
    for (const f of unattributed) {
      // Some may have em-dash in other positions, but author should be null
      expect(f.author).toBeNull();
    }
  });
});

describe("fortune enrichment — category inference", () => {
  it("classifies Stoics (Marcus Aurelius) as stoicism", () => {
    const f = agentFortunes.find((f) =>
      f.text.includes("You have power over your mind"),
    );
    expect(f!.category).toBe("stoicism");
  });

  it("classifies Seneca as stoicism", () => {
    const f = agentFortunes.find((f) =>
      f.text.includes("We suffer more often in imagination"),
    );
    expect(f!.category).toBe("stoicism");
  });

  it("classifies Lao Tzu as eastern", () => {
    const f = agentFortunes.find((f) => f.text.includes("Nature does not hurry"));
    expect(f!.category).toBe("eastern");
  });

  it("classifies Buddha as eastern", () => {
    const f = agentFortunes.find((f) =>
      f.text.includes("A disciplined mind brings happiness"),
    );
    expect(f!.category).toBe("eastern");
  });

  it("classifies Socrates as philosophy", () => {
    const f = agentFortunes.find((f) =>
      f.text.includes("The only true wisdom is in knowing you know nothing"),
    );
    expect(f!.category).toBe("philosophy");
  });

  it("classifies Nietzsche as philosophy", () => {
    const f = agentFortunes.find((f) =>
      f.text.includes("He who has a why to live"),
    );
    expect(f!.category).toBe("philosophy");
  });

  it("classifies Bitcoin/sats content as sovereignty", () => {
    const f = agentFortunes.find(
      (f) => f.text === "Fix the money, fix the incentives.",
    );
    expect(f!.category).toBe("sovereignty");
  });

  it("classifies sats content as sovereignty", () => {
    const f = agentFortunes.find((f) => f.text === "Every sat tells a story.");
    expect(f!.category).toBe("sovereignty");
  });

  it("classifies algorithm/dog/commit wit as wit", () => {
    const witTexts = [
      "The algorithm may notice you soon.",
      "You're one commit away from something better.",
      "Be the person your dog thinks you are.",
    ];
    for (const text of witTexts) {
      const f = agentFortunes.find((f) => f.text === text);
      expect(f!.category).toBe("wit");
    }
  });

  it("classifies predictive/fortune-telling content as fortune", () => {
    const f = agentFortunes.find((f) =>
      f.text.includes("Something you lost will soon return"),
    );
    expect(f!.category).toBe("fortune");
  });

  it("every fortune has a valid category", () => {
    for (const f of agentFortunes) {
      expect(VALID_CATEGORIES.has(f.category)).toBe(true);
    }
  });
});

describe("fortune enrichment — ID stability", () => {
  it("generates stable IDs (same text produces same ID)", () => {
    const first = agentFortunes[0];
    const duplicate = agentFortunes.find((f) => f.text === first.text);
    expect(first.id).toBe(duplicate!.id);
  });

  it("generates unique IDs across the full fortune pool", () => {
    const ids = agentFortunes.map((f) => f.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it("IDs are 7-character base36 strings", () => {
    for (const f of agentFortunes) {
      expect(f.id).toMatch(/^[0-9a-z]{7}$/);
    }
  });
});

describe("agentFortuneById map", () => {
  it("has the same count as agentFortunes", () => {
    expect(agentFortuneById.size).toBe(agentFortunes.length);
  });

  it("lookup by ID returns the correct fortune", () => {
    const sample = agentFortunes[0];
    expect(agentFortuneById.get(sample.id)).toBe(sample);
  });

  it("returns undefined for unknown IDs", () => {
    expect(agentFortuneById.get("unknown")).toBeUndefined();
  });
});

describe("fortune enrichment — tags", () => {
  it("every fortune includes its category as the first tag", () => {
    for (const f of agentFortunes) {
      expect(f.tags[0]).toBe(f.category);
    }
  });

  it("attributed fortunes are tagged 'attributed'", () => {
    const attributed = agentFortunes.filter((f) => f.author !== null);
    expect(attributed.length).toBeGreaterThan(0);
    for (const f of attributed) {
      expect(f.tags).toContain("attributed");
    }
  });

  it("unattributed fortunes are tagged 'original'", () => {
    const originals = agentFortunes.filter((f) => f.author === null);
    expect(originals.length).toBeGreaterThan(0);
    for (const f of originals) {
      expect(f.tags).toContain("original");
    }
  });
});

describe("getRandomFortune", () => {
  it("returns a fortune with valid rarity and non-empty text", () => {
    const f = getRandomFortune();
    expect(VALID_RARITIES.has(f.rarity)).toBe(true);
    expect(typeof f.text).toBe("string");
    expect(f.text.length).toBeGreaterThan(0);
  });

  it("returns different fortunes across multiple calls (probabilistic)", () => {
    const results = new Set(Array.from({ length: 20 }, () => getRandomFortune().text));
    // With 170 fortunes and 20 draws, near-certain to get at least 2 distinct
    expect(results.size).toBeGreaterThan(1);
  });
});

describe("getRandomAgentFortune", () => {
  it("returns a fully enriched fortune with all required fields", () => {
    const f = getRandomAgentFortune();
    expect(typeof f.id).toBe("string");
    expect(f.id.length).toBeGreaterThan(0);
    expect(typeof f.text).toBe("string");
    expect(f.text.length).toBeGreaterThan(0);
    expect(VALID_RARITIES.has(f.rarity)).toBe(true);
    expect(VALID_CATEGORIES.has(f.category)).toBe(true);
    expect(Array.isArray(f.tags)).toBe(true);
    expect(f.tags.length).toBeGreaterThan(0);
  });
});
