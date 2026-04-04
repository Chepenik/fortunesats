/**
 * FortuneSats configuration layer.
 *
 * Central config for pricing, rarity weights, and feature toggles.
 * Designed so values can later be driven by Vercel Flags, Edge Config,
 * or a CLI/agent without requiring redeployment.
 *
 * Environment variable overrides (optional):
 *   FS_FORTUNE_PRICE      — single fortune price in sats (default: 100)
 *   FS_PACK_PRICE         — pack base price in sats (default: 10000)
 *   FS_PACK_SIZE          — fortunes per pack (default: 100)
 *   FS_AGENT_API          — enable agent API ("true"/"false", default: "true")
 *   FS_L402               — enable L402 gating ("true"/"false", default: "false")
 */

/* ─── Types ────────────────────────────────────────────────── */

export interface PricingConfig {
  fortuneSingle: number;
  fortuneGift: number;
  fortunePack: number;
  packSize: number;
}

export interface RarityWeights {
  legendary: number;
  epic: number;
  rare: number;
  common: number;
}

export interface FeatureFlags {
  leaderboard: boolean;
  streaks: boolean;
  collections: boolean;
  sharing: boolean;
  agentApi: boolean;
  l402: boolean;
  promos: boolean;
}

export interface AppConfig {
  pricing: PricingConfig;
  rarity: { weights: RarityWeights };
  features: FeatureFlags;
}

/* ─── Helpers ──────────────────────────────────────────────── */

function envInt(key: string, fallback: number): number {
  const v = process.env[key];
  if (!v) return fallback;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

function envBool(key: string, fallback: boolean): boolean {
  const v = process.env[key];
  if (!v) return fallback;
  return v === "true";
}

/* ─── Config ───────────────────────────────────────────────── */

export const config: AppConfig = {
  pricing: {
    fortuneSingle: envInt("FS_FORTUNE_PRICE", 100),
    fortuneGift: envInt("FS_GIFT_PRICE", 200),
    fortunePack: envInt("FS_PACK_PRICE", 10_000),
    packSize: envInt("FS_PACK_SIZE", 100),
  },

  rarity: {
    weights: {
      legendary: 0.05,
      epic: 0.15,
      rare: 0.30,
      common: 0.50,
    },
  },

  features: {
    leaderboard: true,
    streaks: true,
    collections: true,
    sharing: true,
    agentApi: envBool("FS_AGENT_API", true),
    l402: envBool("FS_L402", false),
    promos: false,
  },
};
