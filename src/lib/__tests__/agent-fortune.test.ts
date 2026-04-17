import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/redis", () => ({ getRedis: vi.fn(() => null) }));

import {
  agentFortunes,
  agentFortuneById,
  getRandomAgentFortune,
  type AgentFortune,
  type Category,
} from "@/lib/fortunes";

const VALID_RARITIES = new Set(["legendary", "epic", "rare", "common"]);
const VALID_CATEGORIES = new Set<Category>([
  "stoicism", "philosophy", "eastern", "sovereignty", "growth", "fortune", "wit",
]);

describe("agentFortunes pool integrity", () => {
  it("has at least 100 fortunes", () => {
    expect(agentFortunes.length).toBeGreaterThanOrEqual(100);
  });

  it("every fortune has a valid rarity", () => {
    const invalid = agentFortunes.filter((f) => !VALID_RARITIES.has(f.rarity));
    expect(invalid).toHaveLength(0);
  });

  it("every fortune has a valid category", () => {
    const invalid = agentFortunes.filter((f) => !VALID_CATEGORIES.has(f.category));
    expect(invalid).toHaveLength(0);
  });

  it("every fortune has a non-empty id (7 chars)", () => {
    const bad = agentFortunes.filter((f) => !f.id || f.id.length !== 7);
    expect(bad).toHaveLength(0);
  });

  it("fortune IDs are unique across the entire pool", () => {
    const ids = agentFortunes.map((f) => f.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it("every fortune has a non-empty text", () => {
    const bad = agentFortunes.filter((f) => !f.text || f.text.trim().length === 0);
    expect(bad).toHaveLength(0);
  });

  it("every fortune has tags including its category", () => {
    const bad = agentFortunes.filter((f) => !f.tags.includes(f.category));
    expect(bad).toHaveLength(0);
  });

  it("every fortune is tagged attributed or original (not both)", () => {
    for (const f of agentFortunes) {
      const hasAttributed = f.tags.includes("attributed");
      const hasOriginal = f.tags.includes("original");
      expect(hasAttributed !== hasOriginal).toBe(true);
    }
  });
});

describe("author extraction via AgentFortune.author", () => {
  it("attributed fortunes have a non-null author", () => {
    const attributed = agentFortunes.filter((f) => f.tags.includes("attributed"));
    expect(attributed.length).toBeGreaterThan(0);
    const withoutAuthor = attributed.filter((f) => f.author === null);
    expect(withoutAuthor).toHaveLength(0);
  });

  it("original fortunes have null author", () => {
    const original = agentFortunes.filter((f) => f.tags.includes("original"));
    expect(original.length).toBeGreaterThan(0);
    const withAuthor = original.filter((f) => f.author !== null);
    expect(withAuthor).toHaveLength(0);
  });

  it("Marcus Aurelius is extracted correctly", () => {
    const marcusFortunes = agentFortunes.filter(
      (f) => f.author && f.author.includes("Marcus Aurelius"),
    );
    expect(marcusFortunes.length).toBeGreaterThan(0);
    for (const f of marcusFortunes) {
      expect(f.author).toBe("Marcus Aurelius");
    }
  });

  it("Seneca is extracted correctly", () => {
    const senecaFortunes = agentFortunes.filter(
      (f) => f.author && f.author.includes("Seneca"),
    );
    expect(senecaFortunes.length).toBeGreaterThan(0);
  });
});

describe("category inference", () => {
  it("Marcus Aurelius fortunes are stoicism", () => {
    const fortunes = agentFortunes.filter(
      (f) => f.author && f.author.includes("Marcus Aurelius"),
    );
    expect(fortunes.every((f) => f.category === "stoicism")).toBe(true);
  });

  it("Seneca fortunes are stoicism", () => {
    const fortunes = agentFortunes.filter(
      (f) => f.author && f.author.includes("Seneca"),
    );
    expect(fortunes.every((f) => f.category === "stoicism")).toBe(true);
  });

  it("Lao Tzu fortunes are eastern", () => {
    const fortunes = agentFortunes.filter(
      (f) => f.author && f.author.includes("Lao Tzu"),
    );
    expect(fortunes.length).toBeGreaterThan(0);
    expect(fortunes.every((f) => f.category === "eastern")).toBe(true);
  });

  it("sovereignty keywords produce sovereignty category", () => {
    const fortunes = agentFortunes.filter((f) => f.category === "sovereignty");
    expect(fortunes.length).toBeGreaterThan(0);
    // All sovereignty fortunes should contain a sovereignty keyword in their text
    for (const f of fortunes) {
      const lower = f.text.toLowerCase();
      const sovereigntyKw = [
        "sats", "money", "bitcoin", "proof of work", "time preference",
        "fix the", "savings", "sound money", "freedom compounds",
        "sovereign", "value for value",
      ];
      expect(sovereigntyKw.some((k) => lower.includes(k))).toBe(true);
    }
  });

  it("all categories are represented in the pool", () => {
    for (const cat of VALID_CATEGORIES) {
      const fortunes = agentFortunes.filter((f) => f.category === cat);
      expect(fortunes.length, `category "${cat}" has no fortunes`).toBeGreaterThan(0);
    }
  });
});

describe("agentFortuneById lookup", () => {
  it("map has the same size as the pool", () => {
    expect(agentFortuneById.size).toBe(agentFortunes.length);
  });

  it("every fortune can be looked up by its own id", () => {
    for (const f of agentFortunes) {
      expect(agentFortuneById.get(f.id)).toBe(f);
    }
  });

  it("returns undefined for unknown id", () => {
    expect(agentFortuneById.get("zzzzzzz")).toBeUndefined();
  });

  it("lookup returns the complete AgentFortune shape", () => {
    const f = agentFortunes[0];
    const looked = agentFortuneById.get(f.id)!;
    expect(looked).toHaveProperty("id");
    expect(looked).toHaveProperty("text");
    expect(looked).toHaveProperty("author");
    expect(looked).toHaveProperty("rarity");
    expect(looked).toHaveProperty("category");
    expect(looked).toHaveProperty("tags");
  });
});

describe("getRandomAgentFortune", () => {
  it("returns a valid AgentFortune", () => {
    const f: AgentFortune = getRandomAgentFortune();
    expect(VALID_RARITIES.has(f.rarity)).toBe(true);
    expect(VALID_CATEGORIES.has(f.category)).toBe(true);
    expect(f.id).toHaveLength(7);
    expect(f.text.length).toBeGreaterThan(0);
  });

  it("returns different fortunes across calls (probabilistic)", () => {
    const results = new Set(Array.from({ length: 30 }, () => getRandomAgentFortune().id));
    // With 30 draws from 170+ pool, expect more than 1 unique result
    expect(results.size).toBeGreaterThan(1);
  });
});

describe("pool filtering (simulates agent endpoint behavior)", () => {
  it("filtering by category returns only matching fortunes", () => {
    for (const cat of VALID_CATEGORIES) {
      const filtered = agentFortunes.filter((f) => f.category === cat);
      expect(filtered.every((f) => f.category === cat)).toBe(true);
    }
  });

  it("filtering by rarity returns only matching fortunes", () => {
    for (const rarity of VALID_RARITIES) {
      const filtered = agentFortunes.filter((f) => f.rarity === rarity);
      if (filtered.length > 0) {
        expect(filtered.every((f) => f.rarity === rarity)).toBe(true);
      }
    }
  });

  it("filtering by unknown category yields empty array", () => {
    // @ts-expect-error testing invalid input
    const filtered = agentFortunes.filter((f) => f.category === "invalid_cat");
    expect(filtered).toHaveLength(0);
  });

  it("intersection filter (category + rarity) is a subset of each individual filter", () => {
    const byCat = agentFortunes.filter((f) => f.category === "stoicism");
    const byRarity = agentFortunes.filter((f) => f.rarity === "legendary");
    const intersection = agentFortunes.filter(
      (f) => f.category === "stoicism" && f.rarity === "legendary",
    );
    for (const f of intersection) {
      expect(byCat.includes(f)).toBe(true);
      expect(byRarity.includes(f)).toBe(true);
    }
  });
});
