import type { Rarity } from "@/lib/fortunes";

/* ─── Fortune slug encoding (stateless, deterministic) ──── */

/**
 * Encode fortune text + rarity into a URL-safe base64 slug.
 * Works in browser, edge, and Node.js.
 */
export function encodeFortuneSlug(text: string, rarity: Rarity): string {
  const json = JSON.stringify({ t: text, r: rarity });
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Decode a fortune slug back into text + rarity.
 * Returns null on invalid/corrupted slugs.
 */
export function decodeFortuneSlug(
  slug: string,
): { text: string; rarity: Rarity } | null {
  try {
    const base64 = slug.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const json = new TextDecoder().decode(bytes);
    const data = JSON.parse(json);
    if (typeof data.t !== "string" || typeof data.r !== "string") return null;
    const validRarities = ["legendary", "epic", "rare", "common"];
    if (!validRarities.includes(data.r)) return null;
    return { text: data.t, rarity: data.r as Rarity };
  } catch {
    return null;
  }
}

/* ─── Fortune text parsing ──────────────────────────────── */

/**
 * Split "The obstacle is the way. — Marcus Aurelius" into
 * { quote: "The obstacle is the way.", author: "Marcus Aurelius" }
 */
export function parseFortune(text: string): {
  quote: string;
  author: string | null;
} {
  // Match " — Author" or " — Author" at the end
  const match = text.match(/^(.+?)\s*[—–-]\s+([A-Z].+)$/);
  if (match) {
    return { quote: match[1].trim(), author: match[2].trim() };
  }
  return { quote: text, author: null };
}

/* ─── Dynamic font sizing for OG cards ──────────────────── */

export function getQuoteFontSize(text: string): number {
  const len = text.length;
  if (len <= 60) return 44;
  if (len <= 90) return 38;
  if (len <= 120) return 32;
  if (len <= 160) return 28;
  return 24;
}

/* ─── Rarity color palette for OG rendering ─────────────── */

export const OG_RARITY_COLORS: Record<
  Rarity,
  { accent: string; glow: string; badge: string; badgeText: string; badgeBorder: string }
> = {
  legendary: {
    accent: "#d4a257",
    glow: "rgba(212, 162, 87, 0.14)",
    badge: "rgba(212, 162, 87, 0.12)",
    badgeText: "#d4a257",
    badgeBorder: "rgba(212, 162, 87, 0.3)",
  },
  epic: {
    accent: "#a855f7",
    glow: "rgba(168, 85, 247, 0.12)",
    badge: "rgba(168, 85, 247, 0.10)",
    badgeText: "#c084fc",
    badgeBorder: "rgba(168, 85, 247, 0.25)",
  },
  rare: {
    accent: "#60a5fa",
    glow: "rgba(96, 165, 250, 0.10)",
    badge: "rgba(96, 165, 250, 0.08)",
    badgeText: "#93bbfc",
    badgeBorder: "rgba(96, 165, 250, 0.20)",
  },
  common: {
    accent: "#a8a29e",
    glow: "rgba(168, 162, 158, 0.06)",
    badge: "rgba(168, 162, 158, 0.06)",
    badgeText: "#a8a29e",
    badgeBorder: "rgba(168, 162, 158, 0.15)",
  },
};

export const RARITY_LABELS: Record<Rarity, string> = {
  legendary: "LEGENDARY",
  epic: "EPIC",
  rare: "RARE",
  common: "COMMON",
};
