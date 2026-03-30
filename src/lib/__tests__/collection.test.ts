import { describe, it, expect, beforeEach, vi } from "vitest";
import { getCollection, saveToCollection, getCollectionStats } from "@/lib/collection";

// Mock localStorage + window check
const store: Record<string, string> = {};

beforeEach(() => {
  Object.keys(store).forEach((k) => delete store[k]);

  // Ensure `typeof window` is defined (vitest runs in node by default)
  if (typeof globalThis.window === "undefined") {
    // @ts-expect-error — minimal window shim for SSR guard
    globalThis.window = {};
  }

  Object.defineProperty(globalThis, "localStorage", {
    value: {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, val: string) => { store[key] = val; },
      removeItem: (key: string) => { delete store[key]; },
    },
    writable: true,
    configurable: true,
  });
});

describe("collection", () => {
  it("returns empty array when nothing stored", () => {
    expect(getCollection()).toEqual([]);
  });

  it("saves and retrieves a fortune", () => {
    saveToCollection("Test fortune", "rare");
    const col = getCollection();
    expect(col).toHaveLength(1);
    expect(col[0].text).toBe("Test fortune");
    expect(col[0].rarity).toBe("rare");
    expect(col[0].pullCount).toBe(1);
  });

  it("de-duplicates by text and increments pullCount", () => {
    saveToCollection("Duplicate fortune", "common");
    saveToCollection("Duplicate fortune", "common");
    saveToCollection("Duplicate fortune", "common");
    const col = getCollection();
    expect(col).toHaveLength(1);
    expect(col[0].pullCount).toBe(3);
  });

  it("stores multiple unique fortunes", () => {
    saveToCollection("Fortune A", "legendary");
    saveToCollection("Fortune B", "epic");
    saveToCollection("Fortune C", "rare");
    const col = getCollection();
    expect(col).toHaveLength(3);
    // Most recent first
    expect(col[0].text).toBe("Fortune C");
  });

  it("computes stats correctly", () => {
    saveToCollection("L1", "legendary");
    saveToCollection("E1", "epic");
    saveToCollection("E2", "epic");
    saveToCollection("R1", "rare");
    saveToCollection("C1", "common");
    saveToCollection("C2", "common");
    saveToCollection("C3", "common");
    const stats = getCollectionStats(getCollection());
    expect(stats).toEqual({
      total: 7,
      legendary: 1,
      epic: 2,
      rare: 1,
      common: 3,
    });
  });
});
