/**
 * Feature flags for FortuneSats.
 *
 * All flags are env-var backed with safe defaults that preserve
 * current behavior when unset. This is the ONLY module that reads
 * flag-related environment variables.
 *
 * Toggle via: `vercel env add FORTUNE_SINGLE_ENABLED false`
 * or locally: `FORTUNE_SINGLE_ENABLED=false next dev`
 */

export interface Flags {
  /** Gate the single-fortune Lightning flow. Default: true */
  fortuneSingleEnabled: boolean;
  /** Gate new on-chain pack order creation. Existing packs remain claimable. Default: true */
  fortunePackEnabled: boolean;
  /** Show/hide the leaderboard page and nav link. Writes still happen. Default: true */
  leaderboardEnabled: boolean;
  /** Show/hide the live activity feed on the homepage. Default: true */
  activityFeedEnabled: boolean;
  /** Skip payment — give fortunes free. Records 0 sats to leaderboard. Default: false */
  freeFortunePromo: boolean;
  /** Scale the 5% legendary base rate. Clamped to [0.5, 4.0]. Default: 1.0 */
  legendaryRateMultiplier: number;
  /** Mix seasonal bonus fortunes into the pool. Default: false */
  seasonalPoolEnabled: boolean;
  /** Enable paid fortune gifting. Default: true */
  giftEnabled: boolean;
}

function envBool(key: string, fallback: boolean): boolean {
  const v = process.env[key];
  if (v === undefined || v === "") return fallback;
  return v === "true" || v === "1";
}

function envNumber(key: string, fallback: number, min: number, max: number): number {
  const v = process.env[key];
  if (v === undefined || v === "") return fallback;
  const n = parseFloat(v);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function getFlags(): Flags {
  return {
    fortuneSingleEnabled: envBool("FORTUNE_SINGLE_ENABLED", true),
    fortunePackEnabled: envBool("FORTUNE_PACK_ENABLED", true),
    leaderboardEnabled: envBool("LEADERBOARD_ENABLED", true),
    activityFeedEnabled: envBool("ACTIVITY_FEED_ENABLED", true),
    freeFortunePromo: envBool("FREE_FORTUNE_PROMO", false),
    legendaryRateMultiplier: envNumber("LEGENDARY_RATE_MULTIPLIER", 1.0, 0.5, 4.0),
    seasonalPoolEnabled: envBool("SEASONAL_POOL_ENABLED", false),
    giftEnabled: envBool("GIFT_ENABLED", true),
  };
}

/** Standard 503 response for disabled features. */
export function unavailableResponse(feature: string) {
  return Response.json(
    { error: { code: "temporarily_unavailable", message: `${feature} is temporarily unavailable. Please try again later.` } },
    { status: 503 },
  );
}
