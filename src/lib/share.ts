import type { Rarity } from "@/lib/fortunes";
import { encodeFortuneSlug } from "@/lib/og";

export const SITE_URL = "https://fortunesats.com";

/**
 * Build a per-fortune share URL with OG card support.
 * Falls back to site URL if encoding fails.
 */
export function buildFortuneUrl(fortune: string, rarity: Rarity): string {
  try {
    const slug = encodeFortuneSlug(fortune, rarity);
    return `${SITE_URL}/fortune/${slug}`;
  } catch {
    return SITE_URL;
  }
}

const X_TCO_LENGTH = 23; // X shortens all URLs to 23 chars

/* ─── Rarity labels for share text ───────────────────────── */

const RARITY_LABELS: Record<Rarity, string> = {
  legendary: "LEGENDARY",
  epic: "EPIC",
  rare: "RARE",
  common: "",
};

function rarityPrefix(rarity: Rarity): string {
  const label = RARITY_LABELS[rarity];
  return label ? `[${label}] ` : "";
}

/* ─── Share copy variants (A/B testable) ───────────────── */

export interface ShareVariant {
  id: number;
  label: string;
  template: (fortune: string, rarity?: Rarity) => string;
}

export const SHARE_VARIANTS: ShareVariant[] = [
  {
    id: 0,
    label: "classic",
    template: (f, r) =>
      `🥠 ${rarityPrefix(r ?? "common")}I paid 100 sats for a fortune:\n\n"${f}"\n\nGet yours → ${r ? buildFortuneUrl(f, r) : SITE_URL}`,
  },
  {
    id: 1,
    label: "punchy",
    template: (f, r) =>
      `100 sats. One fortune.${r && r !== "common" ? ` ${RARITY_LABELS[r]}.` : ""} Worth it.\n\n"${f}"\n\nGet your own → ${r ? buildFortuneUrl(f, r) : SITE_URL}`,
  },
  {
    id: 2,
    label: "storyteller",
    template: (f, r) =>
      `I spent 100 sats on FortuneSats and got this${r && r !== "common" ? ` ${RARITY_LABELS[r]}` : ""}:\n\n"${f}"\n\nTry it → ${r ? buildFortuneUrl(f, r) : SITE_URL}`,
  },
  {
    id: 3,
    label: "direct",
    template: (f, r) =>
      `Paid 100 sats for a fortune:${r && r !== "common" ? ` [${RARITY_LABELS[r]}]` : ""}\n\n"${f}"\n\nGet yours → ${r ? buildFortuneUrl(f, r) : SITE_URL}`,
  },
];

export const PACK_SHARE_VARIANTS: ShareVariant[] = [
  {
    id: 0,
    label: "classic",
    template: (f, r) =>
      `🥠 ${rarityPrefix(r ?? "common")}I bought the Fortune Pack (100 fortunes for 10k sats) and got this gem:\n\n"${f}"\n\nGet yours → ${r ? buildFortuneUrl(f, r) : SITE_URL}`,
  },
  {
    id: 1,
    label: "punchy",
    template: (f, r) =>
      `10,000 sats. 100 fortunes.${r && r !== "common" ? ` Got a ${RARITY_LABELS[r]}.` : ""} Worth every sat.\n\n"${f}"\n\nGet the Fortune Pack → ${r ? buildFortuneUrl(f, r) : SITE_URL}`,
  },
  {
    id: 2,
    label: "storyteller",
    template: (f, r) =>
      `I spent 10k sats on a Fortune Pack from FortuneSats and got this${r && r !== "common" ? ` ${RARITY_LABELS[r]}` : ""}:\n\n"${f}"\n\nTry it → ${r ? buildFortuneUrl(f, r) : SITE_URL}`,
  },
  {
    id: 3,
    label: "direct",
    template: (f, r) =>
      `Paid 10k sats for 100 fortunes on FortuneSats:${r && r !== "common" ? ` [${RARITY_LABELS[r]}]` : ""}\n\n"${f}"\n\nGet the Fortune Pack → ${r ? buildFortuneUrl(f, r) : SITE_URL}`,
  },
];

export function pickVariant(isPack = false): ShareVariant {
  const variants = isPack ? PACK_SHARE_VARIANTS : SHARE_VARIANTS;
  return variants[Math.floor(Math.random() * variants.length)];
}

/* ─── X (Twitter) sharing ──────────────────────────────── */

/**
 * Truncate fortune to fit X's ~280 char limit.
 * Accounts for t.co URL shortening (all URLs → 23 chars).
 */
export function truncateForX(
  fortune: string,
  template: (f: string, r?: Rarity) => string,
  rarity?: Rarity,
): string {
  const LIMIT = 275; // conservative for emoji weighting
  const full = template(fortune, rarity);
  // X shortens ALL URLs to 23 chars via t.co, regardless of actual length
  const effective = full.replace(/https?:\/\/\S+/g, "x".repeat(X_TCO_LENGTH)).length;

  if (effective <= LIMIT) return fortune;

  const excess = effective - LIMIT;
  const maxLen = fortune.length - excess - 1; // -1 for "…"

  if (maxLen < 20) return fortune.slice(0, 50) + "\u2026";

  // Truncate at word boundary when possible
  const cut = fortune.slice(0, maxLen);
  const space = cut.lastIndexOf(" ");
  return (space > maxLen * 0.6 ? cut.slice(0, space) : cut) + "\u2026";
}

export function buildXShareUrl(
  fortune: string,
  variant: ShareVariant,
  rarity?: Rarity,
): string {
  const truncated = truncateForX(fortune, variant.template, rarity);
  const text = variant.template(truncated, rarity);
  return `https://x.com/intent/post?text=${encodeURIComponent(text)}`;
}

/* ─── Clipboard / native share ─────────────────────────── */

export function buildShareText(
  fortune: string,
  variant: ShareVariant,
  rarity?: Rarity,
): string {
  return variant.template(fortune, rarity);
}

export function canNativeShare(): boolean {
  return typeof navigator !== "undefined" && !!navigator.share;
}

export async function nativeShare(
  fortune: string,
  variant: ShareVariant,
  rarity?: Rarity,
): Promise<boolean> {
  if (!canNativeShare()) return false;
  try {
    await navigator.share({ text: variant.template(fortune, rarity) });
    return true;
  } catch {
    return false; // user cancelled
  }
}

/* ─── Analytics ────────────────────────────────────────── */

export type ShareAction =
  | "x_share"
  | "copy_text"
  | "copy_link"
  | "native_share";

/**
 * Track a share event. Dispatches a custom DOM event that analytics
 * integrations (Vercel Analytics, PostHog, etc.) can listen for.
 */
export function trackShare(action: ShareAction, variantId: number): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("fortunesats:share", {
      detail: { action, variantId, timestamp: Date.now() },
    }),
  );
}
