"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

/* ─── Types ──────────────────────────────────────────────── */

type Tab = "fortunes" | "sats" | "legendary" | "streak";

interface Entry {
  rank: number;
  displayName: string;
  score: number;
  isYou: boolean;
}

interface YouData {
  displayName: string;
  fortunes: { rank: number; score: number } | null;
  sats: { rank: number; score: number } | null;
  legendary: { rank: number; score: number } | null;
  streak: { rank: number; score: number } | null;
}

interface LeaderboardData {
  fortunes: Entry[];
  sats: Entry[];
  legendary: Entry[];
  streak: Entry[];
  you: YouData | null;
}

/* ─── Tab config ─────────────────────────────────────────── */

const TABS: { key: Tab; label: string; emptyLabel: string }[] = [
  { key: "fortunes", label: "Most Revealed", emptyLabel: "No fortunes revealed yet" },
  { key: "sats", label: "Top Spenders", emptyLabel: "No sats spent yet" },
  { key: "legendary", label: "Legendary", emptyLabel: "No legendary fortunes yet" },
  { key: "streak", label: "Streaks", emptyLabel: "No streaks yet" },
];

/* ─── Helpers ────────────────────────────────────────────── */

function formatScore(score: number, tab: Tab): string {
  if (tab === "sats") return score.toLocaleString() + " sats";
  if (tab === "streak") return score + " in a row";
  return score.toLocaleString();
}

function rankIndicator(rank: number): string {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return `#${rank}`;
}

function rankColor(rank: number): string {
  if (rank === 1) return "text-gold";
  if (rank === 2) return "text-foreground/70";
  if (rank === 3) return "text-amber-700";
  return "text-muted-foreground/50";
}

/* ─── Component ──────────────────────────────────────────── */

export function LeaderboardView() {
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [tab, setTab] = useState<Tab>("fortunes");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/leaderboard")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const entries = data ? data[tab] : [];
  const youStat = data?.you?.[tab];
  const youInList = entries.some((e) => e.isYou);

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div role="tablist" className="flex gap-1 p-1 rounded-xl bg-background/40 border border-gold/[0.06]">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 px-2 py-2.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              tab === t.key
                ? "bg-gold/[0.08] text-gold border border-gold/15"
                : "text-muted-foreground/45 hover:text-muted-foreground/65 border border-transparent"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* List */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25 }}
        >
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-6 w-6 rounded-full border border-gold/10 border-t-gold/40 animate-spin" />
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-16 space-y-3">
              <p className="text-3xl">🥠</p>
              <p className="text-sm text-muted-foreground/40">
                {TABS.find((t) => t.key === tab)?.emptyLabel}
              </p>
              <p className="text-xs text-muted-foreground/25">
                Be the first to claim your place.
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {entries.map((entry) => (
                <div
                  key={entry.rank}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                    entry.isYou
                      ? "bg-gold/[0.06] border border-gold/15"
                      : "hover:bg-foreground/[0.02]"
                  }`}
                >
                  {/* Rank */}
                  <span className={`w-8 text-sm font-mono font-medium ${rankColor(entry.rank)}`}>
                    {rankIndicator(entry.rank)}
                  </span>

                  {/* Name */}
                  <span className={`flex-1 text-sm truncate ${
                    entry.isYou ? "text-gold font-medium" : "text-foreground/70"
                  }`}>
                    {entry.displayName}
                    {entry.isYou && (
                      <span className="ml-2 text-[11px] text-gold/50 uppercase tracking-wider">
                        you
                      </span>
                    )}
                  </span>

                  {/* Score */}
                  <span className={`text-sm font-mono tabular-nums ${
                    entry.rank <= 3 ? "text-gold/80" : "text-muted-foreground/50"
                  }`}>
                    {formatScore(entry.score, tab)}
                  </span>
                </div>
              ))}

              {/* "You" row if not in top list */}
              {data?.you && youStat && !youInList && (
                <>
                  <div className="flex items-center gap-2 py-1 px-4">
                    <div className="flex-1 h-px bg-gold/[0.06]" />
                    <span className="text-[11px] text-gold/25 font-mono">···</span>
                    <div className="flex-1 h-px bg-gold/[0.06]" />
                  </div>
                  <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gold/[0.04] border border-gold/10">
                    <span className="w-8 text-sm font-mono font-medium text-gold/50">
                      #{youStat.rank}
                    </span>
                    <span className="flex-1 text-sm text-gold font-medium truncate">
                      {data.you.displayName}
                      <span className="ml-2 text-[11px] text-gold/50 uppercase tracking-wider">
                        you
                      </span>
                    </span>
                    <span className="text-sm font-mono tabular-nums text-gold/60">
                      {formatScore(youStat.score, tab)}
                    </span>
                  </div>
                </>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Device disclaimer */}
      <p className="text-[11px] text-center text-muted-foreground/30 leading-relaxed">
        Your progress is tied to this device.
        <br />
        Switching devices or clearing cookies resets your position.
      </p>
    </div>
  );
}
