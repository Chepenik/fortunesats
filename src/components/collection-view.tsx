"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  getCollection,
  getCollectionStats,
  mergeCollections,
  type CollectedFortune,
  type CollectionStats,
} from "@/lib/collection";
import { getStreak, mergeStreaks, type StreakData } from "@/lib/streak";
import {
  FORTUNE_POOL_TOTAL,
  FORTUNE_POOL_TOTALS,
  getLuckyPrimeNumbers,
  RARITY_CONFIG,
  type Rarity,
} from "@/lib/fortunes";
import { encodeFortuneSlug, parseFortune } from "@/lib/og";
import { LuckyPrimeRow } from "@/components/shared/lucky-primes";

/* ─── Constants ─────────────────────────────────────────── */

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
    // 1. Load local immediately (fast render)
    const local = getCollection();
    setCollection(local); // eslint-disable-line react-hooks/set-state-in-effect -- localStorage read on mount (SSR-safe pattern)
    setStats(getCollectionStats(local));
    setMounted(true);

    // 2. Hydrate from server and merge
    fetch("/api/collection")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { collection?: CollectedFortune[]; streak?: StreakData } | null) => {
        if (!data?.collection?.length && !data?.streak) return;

        const serverCol = data.collection ?? [];
        const freshLocal = getCollection(); // re-read in case reveal happened since mount
        const merged = mergeCollections(freshLocal, serverCol);

        // Update state + localStorage if anything changed
        if (merged.length !== freshLocal.length || merged.some((m, i) => m.text !== freshLocal[i]?.text || m.pullCount !== freshLocal[i]?.pullCount)) {
          setCollection(merged);
          setStats(getCollectionStats(merged));
          try { localStorage.setItem("fortunesats:collection", JSON.stringify(merged)); } catch { /* full */ }
        }

        // Merge streaks into localStorage too
        if (data.streak?.lastDate) {
          const localStreak = getStreak();
          const mergedStreak = mergeStreaks(localStreak, data.streak);
          try { localStorage.setItem("fortunesats:streak", JSON.stringify(mergedStreak)); } catch { /* full */ }
        }

        // If local had entries not in server, sync them up
        const serverTexts = new Set(serverCol.map((f) => f.text));
        const hasLocalOnly = freshLocal.some((f) => !serverTexts.has(f.text));
        if (hasLocalOnly) {
          const localStreak = getStreak();
          fetch("/api/collection", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ collection: merged, streak: localStreak }),
          }).catch(() => {}); // non-critical
        }
      })
      .catch(() => {}); // server unavailable — fail silently
  }, []);

  const filtered =
    filter === "all"
      ? collection
      : collection.filter((f) => f.rarity === filter);

  const pct = FORTUNE_POOL_TOTAL > 0
    ? Math.round((stats.total / FORTUNE_POOL_TOTAL) * 100)
    : 0;
  const totalPulls = collection.reduce((sum, f) => sum + f.pullCount, 0);

  if (!mounted) {
    return (
      <div role="status" aria-label="Loading collection" className="flex items-center justify-center py-16">
        <div aria-hidden="true" className="h-6 w-6 rounded-full border border-gold/10 border-t-gold/40 animate-spin" />
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
                <span className="text-lg text-muted-foreground/30">/{FORTUNE_POOL_TOTAL}</span>
              </p>
              <p className="text-xs text-muted-foreground/45 mt-0.5">
                unique signals collected
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold font-mono text-foreground/70">
                {pct}
                <span className="text-sm text-muted-foreground/30">%</span>
              </p>
              {totalPulls > stats.total && (
                <p className="text-[11px] text-muted-foreground/35 font-mono">
                  {totalPulls} total reveals
                </p>
              )}
            </div>
          </div>

          {/* Progress bar */}
          <div
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuetext={`${stats.total} of ${FORTUNE_POOL_TOTAL} fortunes collected`}
            aria-label="Fortune collection progress"
            className="h-2 rounded-full bg-foreground/[0.04] overflow-hidden"
          >
            <motion.div
              aria-hidden="true"
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
              const total = FORTUNE_POOL_TOTALS[r];
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
                      <span className="text-[11px] font-medium" style={{ color: cfg.color }}>
                        {cfg.label}
                      </span>
                      <span className="text-[11px] font-mono text-muted-foreground/35">
                        {count}/{total}
                      </span>
                    </div>
                    <div
                      role="progressbar"
                      aria-valuenow={rarityPct}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuetext={`${count} of ${total} ${cfg.label.toLowerCase()} fortunes`}
                      aria-label={`${cfg.label} collection progress`}
                      className="h-1 rounded-full bg-foreground/[0.04] overflow-hidden"
                    >
                      <div
                        aria-hidden="true"
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

          <p className="text-[11px] text-center text-gold/30 leading-relaxed">
            Legendary is scarce signal. Common still counts. The full set is
            {` ${FORTUNE_POOL_TOTAL}`} core fortunes.
          </p>
        </div>
      </div>

      {/* ── Filter tabs ────────────────────────────────────── */}
      <div role="tablist" aria-label="Filter by rarity" className="flex gap-1 p-1 rounded-xl bg-background/40 border border-gold/[0.06]">
        {FILTERS.map((f) => {
          const count = f.key === "all" ? collection.length : stats[f.key];
          return (
            <button
              key={f.key}
              role="tab"
              id={`col-tab-${f.key}`}
              aria-selected={filter === f.key}
              aria-controls={`col-panel-${f.key}`}
              onClick={() => setFilter(f.key)}
              className={`flex-1 px-2 py-2.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                filter === f.key
                  ? "bg-gold/[0.08] text-gold border border-gold/15"
                  : "text-muted-foreground/45 hover:text-muted-foreground/65 border border-transparent"
              }`}
            >
              {f.label}
              {count > 0 && (
                <span className="ml-1 text-[10px] opacity-50">{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Fortune list ───────────────────────────────────── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={filter}
          role="tabpanel"
          id={`col-panel-${filter}`}
          aria-labelledby={`col-tab-${filter}`}
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
                    ? "No fortunes sealed here yet"
                    : `No ${RARITY_CONFIG[filter].label.toLowerCase()} signal yet`}
                </p>
                <p className="text-xs text-muted-foreground/25">
                  {filter === "all"
                    ? "Request your first 100-sat reveal to begin the set."
                    : "Keep revealing. Scarce wisdom does not arrive on command."}
                </p>
              </div>
              {filter === "all" && (
                <Link
                  href="/"
                  className="inline-block mt-2 px-4 py-2 rounded-lg text-xs font-medium text-gold/70 border border-gold/15 hover:bg-gold/[0.06] transition-colors"
                >
                  Request a fortune
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((fortune) => (
                <Link
                  key={fortune.text}
                  href={`/fortune/${encodeFortuneSlug(fortune.text, fortune.rarity)}`}
                >
                  <FortuneCard fortune={fortune} />
                </Link>
              ))}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Sync note */}
      <p className="text-[11px] text-center text-muted-foreground/30 leading-relaxed">
        Your collection lives on this device and syncs when the oracle can see it.
      </p>
    </div>
  );
}

/* ─── Fortune Card ──────────────────────────────────────── */

function FortuneCard({ fortune }: { fortune: CollectedFortune }) {
  const cfg = RARITY_CONFIG[fortune.rarity];
  const { quote, author } = parseFortune(fortune.text);
  const luckyNumbers = getLuckyPrimeNumbers(fortune.text);
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
        <p className="text-sm leading-relaxed text-foreground/80 italic">
          &ldquo;{quote}&rdquo;
        </p>
        {author && (
          <p className="text-xs text-gold/35 italic">- {author}</p>
        )}

        <LuckyPrimeRow numbers={luckyNumbers} />

        {/* Meta row */}
        <div className="flex items-center justify-between">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium border ${cfg.badgeClass}`}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: cfg.color }}
            />
            {cfg.label}
          </span>

          <div className="flex items-center gap-2 text-[11px] text-muted-foreground/35 font-mono">
            {fortune.pullCount > 1 && (
              <span className="text-gold/35">&times;{fortune.pullCount}</span>
            )}
            <span>{dateStr}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
