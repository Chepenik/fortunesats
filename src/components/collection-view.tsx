"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  getCollection,
  getCollectionStats,
  type CollectedFortune,
  type CollectionStats,
} from "@/lib/collection";
import { RARITY_CONFIG, type Rarity } from "@/lib/fortunes";

/* ─── Constants ─────────────────────────────────────────── */

const POOL_TOTALS: Record<Rarity, number> = {
  legendary: 8,
  epic: 18,
  rare: 38,
  common: 55,
};
const POOL_TOTAL = 119;

type Filter = "all" | Rarity;

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "legendary", label: "Legendary" },
  { key: "epic", label: "Epic" },
  { key: "rare", label: "Rare" },
  { key: "common", label: "Common" },
];

/* ─── Component ─────────────────────────────────────────── */

export function CollectionView() {
  const [collection, setCollection] = useState<CollectedFortune[]>([]);
  const [stats, setStats] = useState<CollectionStats>({
    total: 0,
    legendary: 0,
    epic: 0,
    rare: 0,
    common: 0,
  });
  const [filter, setFilter] = useState<Filter>("all");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const data = getCollection();
    setCollection(data);
    setStats(getCollectionStats(data));
    setMounted(true);
  }, []);

  const filtered =
    filter === "all"
      ? collection
      : collection.filter((f) => f.rarity === filter);

  const pct = POOL_TOTAL > 0 ? Math.round((stats.total / POOL_TOTAL) * 100) : 0;
  const totalPulls = collection.reduce((sum, f) => sum + f.pullCount, 0);

  if (!mounted) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-6 w-6 rounded-full border border-gold/10 border-t-gold/40 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Hero stats card ────────────────────────────────── */}
      <div className="relative rounded-2xl border border-gold/[0.08] bg-background/40 p-5 space-y-4 overflow-hidden">
        {/* Subtle glow */}
        <div className="absolute inset-0 rounded-2xl pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[300px] h-[150px] bg-gold/[0.03] blur-[60px]" />
        </div>

        <div className="relative space-y-4">
          {/* Big number + progress */}
          <div className="flex items-end justify-between">
            <div>
              <p className="text-3xl font-bold font-mono text-gold tracking-tight">
                {stats.total}
                <span className="text-lg text-muted-foreground/30">/{POOL_TOTAL}</span>
              </p>
              <p className="text-[11px] text-muted-foreground/40 mt-0.5">
                unique fortunes collected
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold font-mono text-foreground/70">
                {pct}
                <span className="text-sm text-muted-foreground/30">%</span>
              </p>
              {totalPulls > stats.total && (
                <p className="text-[10px] text-muted-foreground/30 font-mono">
                  {totalPulls} total pulls
                </p>
              )}
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-2 rounded-full bg-foreground/[0.04] overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-gold/50 via-gold/70 to-gold/50"
              initial={{ width: 0 }}
              animate={{ width: `${Math.max(pct, 1)}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
            />
          </div>

          {/* Rarity breakdown — mini progress bars */}
          <div className="grid grid-cols-2 gap-2">
            {(["legendary", "epic", "rare", "common"] as Rarity[]).map((r) => {
              const cfg = RARITY_CONFIG[r];
              const count = stats[r];
              const total = POOL_TOTALS[r];
              const rarityPct = total > 0 ? Math.round((count / total) * 100) : 0;
              return (
                <div
                  key={r}
                  className="flex items-center gap-2 px-2.5 py-2 rounded-lg border border-gold/[0.04] bg-background/30"
                >
                  <span
                    className="h-2 w-2 rounded-full shrink-0"
                    style={{ backgroundColor: cfg.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between mb-1">
                      <span className="text-[10px] font-medium" style={{ color: cfg.color }}>
                        {cfg.label}
                      </span>
                      <span className="text-[10px] font-mono text-muted-foreground/30">
                        {count}/{total}
                      </span>
                    </div>
                    <div className="h-1 rounded-full bg-foreground/[0.04] overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${Math.max(rarityPct, count > 0 ? 4 : 0)}%`,
                          backgroundColor: cfg.color,
                          opacity: 0.6,
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Filter tabs ────────────────────────────────────── */}
      <div className="flex gap-1 p-1 rounded-xl bg-background/40 border border-gold/[0.06]">
        {FILTERS.map((f) => {
          const count = f.key === "all" ? collection.length : stats[f.key];
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`flex-1 px-2 py-2 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
                filter === f.key
                  ? "bg-gold/[0.08] text-gold border border-gold/15"
                  : "text-muted-foreground/40 hover:text-muted-foreground/60 border border-transparent"
              }`}
            >
              {f.label}
              {count > 0 && (
                <span className="ml-1 text-[9px] opacity-50">{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Fortune list ───────────────────────────────────── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={filter}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25 }}
        >
          {filtered.length === 0 ? (
            <div className="text-center py-14 space-y-4">
              <p className="text-3xl">🥠</p>
              <div className="space-y-1.5">
                <p className="text-sm text-muted-foreground/40">
                  {filter === "all"
                    ? "No fortunes collected yet"
                    : `No ${RARITY_CONFIG[filter].label.toLowerCase()} fortunes yet`}
                </p>
                <p className="text-xs text-muted-foreground/25">
                  {filter === "all"
                    ? "Pull your first fortune to start your collection."
                    : "Keep pulling — fortune favors the persistent."}
                </p>
              </div>
              {filter === "all" && (
                <Link
                  href="/"
                  className="inline-block mt-2 px-4 py-2 rounded-lg text-xs font-medium text-gold/70 border border-gold/15 hover:bg-gold/[0.06] transition-colors"
                >
                  Pull a fortune
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((fortune) => (
                <FortuneCard key={fortune.text} fortune={fortune} />
              ))}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Device disclaimer */}
      <p className="text-[10px] text-center text-muted-foreground/25 leading-relaxed">
        Your collection is stored locally on this device.
        <br />
        Switching browsers or clearing storage resets it.
      </p>
    </div>
  );
}

/* ─── Fortune Card ──────────────────────────────────────── */

function FortuneCard({ fortune }: { fortune: CollectedFortune }) {
  const cfg = RARITY_CONFIG[fortune.rarity];
  const date = new Date(fortune.firstPulled);
  const dateStr = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  return (
    <div
      className="relative px-4 py-3.5 rounded-xl border transition-colors hover:bg-foreground/[0.02]"
      style={{
        borderColor: `color-mix(in srgb, ${cfg.color} 12%, transparent)`,
      }}
    >
      {/* Subtle rarity glow */}
      <div
        className="absolute inset-0 rounded-xl opacity-30 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at top left, ${cfg.glowColor}, transparent 70%)`,
        }}
      />

      <div className="relative space-y-2">
        {/* Fortune text */}
        <p className="text-[13px] leading-relaxed text-foreground/80 italic">
          &ldquo;{fortune.text}&rdquo;
        </p>

        {/* Meta row */}
        <div className="flex items-center justify-between">
          <span
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-medium border ${cfg.badgeClass}`}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: cfg.color }}
            />
            {cfg.label}
          </span>

          <div className="flex items-center gap-2 text-[10px] text-muted-foreground/30 font-mono">
            {fortune.pullCount > 1 && (
              <span className="text-gold/30">&times;{fortune.pullCount}</span>
            )}
            <span>{dateStr}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
