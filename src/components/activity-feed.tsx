"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RARITY_CONFIG, type Rarity } from "@/lib/fortunes";
import { ease } from "@/components/shared/animations";

/* ─── Types ──────────────────────────────────────────────── */

interface ActivityEvent {
  displayName: string;
  rarity: Rarity;
  timestamp: number;
}

/* ─── Helpers ────────────────────────────────────────────── */

const VERBS: Record<Rarity, string> = {
  legendary: "unearthed",
  epic: "pulled",
  rare: "revealed",
  common: "got",
};

function relativeTime(ts: number): string {
  const diff = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

/* ─── Component ──────────────────────────────────────────── */

const POLL_INTERVAL = 60_000; // 60 seconds

export function ActivityFeed() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loaded, setLoaded] = useState(false);

  const fetchActivity = useCallback(async () => {
    try {
      const res = await fetch("/api/activity");
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events ?? []);
      }
    } catch {
      // Non-critical — feed is decorative
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    fetchActivity();
    const id = setInterval(fetchActivity, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [fetchActivity]);

  // Don't render anything until first load completes (avoid layout jank)
  if (!loaded) return null;

  // Graceful empty state — render nothing, no placeholder needed
  if (events.length === 0) return null;

  return (
    <div className="w-full space-y-3">
      {/* Section header */}
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gold/8 to-transparent" />
        <div className="flex items-center gap-1.5">
          <div className="h-1 w-1 rounded-full bg-cyan/40 animate-glow-pulse" />
          <span className="text-[9px] tracking-[0.2em] uppercase text-gold/25 font-mono">
            Recent fortunes
          </span>
        </div>
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gold/8 to-transparent" />
      </div>

      {/* Events list */}
      <div className="space-y-1">
        <AnimatePresence initial={false}>
          {events.slice(0, 5).map((event, i) => (
            <motion.div
              key={`${event.displayName}-${event.timestamp}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.35, delay: i * 0.05, ease }}
              className="flex items-center gap-2 py-1.5 px-3 rounded-lg"
            >
              {/* Rarity dot */}
              <div
                className="h-1.5 w-1.5 rounded-full shrink-0"
                style={{
                  backgroundColor: RARITY_CONFIG[event.rarity].color,
                  boxShadow: `0 0 6px ${RARITY_CONFIG[event.rarity].glowColor}`,
                }}
              />

              {/* Event text */}
              <span className="text-[11px] text-foreground/50 truncate">
                <span className="text-foreground/70 font-medium">
                  {event.displayName}
                </span>
                {" "}
                {VERBS[event.rarity]} a{" "}
                <span
                  className="font-medium"
                  style={{ color: RARITY_CONFIG[event.rarity].color }}
                >
                  {RARITY_CONFIG[event.rarity].label}
                </span>
                {" "}fortune
              </span>

              {/* Timestamp */}
              <span className="text-[9px] text-gold/20 font-mono whitespace-nowrap ml-auto shrink-0">
                {relativeTime(event.timestamp)}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
