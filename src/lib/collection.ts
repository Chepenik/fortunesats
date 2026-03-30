/**
 * Fortune collection — localStorage-backed, device-local.
 *
 * Saves every fortune a user reveals so they can revisit them.
 * De-duplicates by fortune text (same fortune only stored once,
 * but pull count is tracked). All state lives in the browser.
 */

import type { Rarity } from "@/lib/fortunes";

const STORAGE_KEY = "fortunesats:collection";

export interface CollectedFortune {
  /** Fortune text — serves as unique key */
  text: string;
  /** Rarity tier */
  rarity: Rarity;
  /** ISO timestamp of first pull */
  firstPulled: string;
  /** How many times this fortune has been pulled */
  pullCount: number;
}

export interface CollectionStats {
  total: number;
  legendary: number;
  epic: number;
  rare: number;
  common: number;
}

/** Load the full collection from localStorage. Returns [] on SSR or error. */
export function getCollection(): CollectedFortune[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as CollectedFortune[];
  } catch {
    return [];
  }
}

/**
 * Save a fortune to the collection.
 * - New fortune: adds entry with pullCount 1
 * - Duplicate: increments pullCount only
 */
export function saveToCollection(text: string, rarity: Rarity): void {
  try {
    const collection = getCollection();
    const existing = collection.find((f) => f.text === text);

    if (existing) {
      existing.pullCount += 1;
    } else {
      collection.unshift({
        text,
        rarity,
        firstPulled: new Date().toISOString(),
        pullCount: 1,
      });
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(collection));
  } catch {
    // Storage full or unavailable — fail silently
  }
}

/** Compute rarity breakdown stats from the collection. */
export function getCollectionStats(collection: CollectedFortune[]): CollectionStats {
  return {
    total: collection.length,
    legendary: collection.filter((f) => f.rarity === "legendary").length,
    epic: collection.filter((f) => f.rarity === "epic").length,
    rare: collection.filter((f) => f.rarity === "rare").length,
    common: collection.filter((f) => f.rarity === "common").length,
  };
}
