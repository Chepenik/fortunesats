"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  getCollection,
  getCollectionStats,
  type CollectedFortune,
  type CollectionStats,
} from "@/lib/collection";
import { RARITY_CONFIG, type Rarity } from "@/lib/fortunes";

/* ─── Constants ─────────────────────────────────────────── */

/** Total fortunes in the pool per rarity */
const POOL_TOTALS: Record<Rarity, number> = {
  legendary: 8,
  epic: 17,
  rare: 38,
  common: 107,
};
const POOL_TOTAL = 170;

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

  if (!mounted) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-6 w-6 rounded-full border border-gold/10 border-t-gold/40 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Stats bar ──────────────────────────────────────── */}
      <div className="space-y-3">
        {/* Progress bar */}
        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-mono text-gold/70">
              {stats.total}
              <span className="text-muted-foreground/30">/{POOL_TOTAL}</span>
            </span>
            <span className="text-[11px] text-muted-foreground/40">
              {pct}% collected
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-foreground/[0.04] overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-gold/40 to-gold/70"
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          </div>
        </div>

        {/* Rarity breakdown pills */}
        <div className="flex gap-2 flex-wrap">
          {(["legendary", "epic", "rare", "common"] as Rarity[]).map((r) => {
            const cfg = RARITY_CONFIG[r];
            const count = stats[r];
            const total = POOL_TOTALS[r];
            return (
              <span
                key={r}
                className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-medium border ${cfg.badgeClass}`}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: cfg.color }}
                />
                {count}/{total} {cfg.label}
              </span>
            );
          })}
        </div>
      </div>

      {/* ── Filter tabs ────────────────────────────────────── */}
      <div className="flex gap-1 p-1 rounded-xl bg-background/40 border border-gold/[0.06]">
        {FILTERS.map((f) => (
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
          </button>
        ))}
      </div>

      {/* ── Fortune grid ───────────────────────────────────── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={filter}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25 }}
        >
          {filtered.length === 0 ? (
            <div className="text-center py-16 space-y-3">
              <p className="text-3xl">🥠</p>
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
