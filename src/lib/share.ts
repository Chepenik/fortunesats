export const SITE_URL = "https://fortunesats.com";

const X_TCO_LENGTH = 23; // X shortens all URLs to 23 chars

/* ─── Share copy variants (A/B testable) ───────────────── */

export interface ShareVariant {
  id: number;
  label: string;
  template: (fortune: string) => string;
}

export const SHARE_VARIANTS: ShareVariant[] = [
  {
    id: 0,
    label: "classic",
    template: (f) =>
      `🥠 I paid 100 sats for a fortune:\n\n"${f}"\n\nGet yours → ${SITE_URL}`,
  },
  {
    id: 1,
    label: "punchy",
    template: (f) =>
      `100 sats. One fortune. Worth it.\n\n"${f}"\n\nGet your own → ${SITE_URL}`,
  },
  {
    id: 2,
    label: "storyteller",
    template: (f) =>
      `I spent 100 sats on FortuneSats and got this:\n\n"${f}"\n\nTry it → ${SITE_URL}`,
  },
  {
    id: 3,
    label: "direct",
    template: (f) =>
      `Paid 100 sats for a fortune:\n\n"${f}"\n\nGet yours → ${SITE_URL}`,
  },
];

export function pickVariant(): ShareVariant {
  return SHARE_VARIANTS[Math.floor(Math.random() * SHARE_VARIANTS.length)];
}

/* ─── X (Twitter) sharing ──────────────────────────────── */

/**
 * Truncate fortune to fit X's ~280 char limit.
 * Accounts for t.co URL shortening (all URLs → 23 chars).
 */
export function truncateForX(
  fortune: string,
  template: (f: string) => string,
): string {
  const LIMIT = 275; // conservative for emoji weighting
  const full = template(fortune);
  const effective = full.replace(SITE_URL, "x".repeat(X_TCO_LENGTH)).length;

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
): string {
  const truncated = truncateForX(fortune, variant.template);
  const text = variant.template(truncated);
  return `https://x.com/intent/post?text=${encodeURIComponent(text)}`;
}

/* ─── Clipboard / native share ─────────────────────────── */

export function buildShareText(
  fortune: string,
  variant: ShareVariant,
): string {
  return variant.template(fortune);
}

export function canNativeShare(): boolean {
  return typeof navigator !== "undefined" && !!navigator.share;
}

export async function nativeShare(
  fortune: string,
  variant: ShareVariant,
): Promise<boolean> {
  if (!canNativeShare()) return false;
  try {
    await navigator.share({ text: variant.template(fortune) });
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
 *
 * Usage:
 *   window.addEventListener("fortunesats:share", (e) => {
 *     track(e.detail.action, { variant: e.detail.variantId });
 *   });
 */
export function trackShare(action: ShareAction, variantId: number): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("fortunesats:share", {
      detail: { action, variantId, timestamp: Date.now() },
    }),
  );
}
