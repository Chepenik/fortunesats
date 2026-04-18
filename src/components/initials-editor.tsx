"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ease } from "@/components/shared/animations";

/* ─── Cookie helper (client-side, non-HttpOnly cookie) ── */

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? match[1] : null;
}

/* ─── Component ──────────────────────────────────────────── */

export function InitialsEditor() {
  const [initials, setInitials] = useState("");
  const [saved, setSaved] = useState<string | null>(null); // current saved initials
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  // Read current initials from cookie on mount
  useEffect(() => {
    const current = readCookie("fsi");
    if (current) {
      setSaved(current);
      setInitials(current);
    }
  }, []);

  const handleSave = useCallback(async () => {
    setError(null);
    setSaving(true);

    try {
      const res = await fetch("/api/identity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initials: initials.trim() || null }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error?.message ?? "Something went wrong");
        return;
      }

      setDisplayName(data.displayName);
      setSaved(data.initials ?? null);
      setInitials(data.initials ?? "");
      setEditing(false);
    } catch {
      setError("Network error — try again");
    } finally {
      setSaving(false);
    }
  }, [initials]);

  const handleClear = useCallback(async () => {
    setError(null);
    setSaving(true);

    try {
      const res = await fetch("/api/identity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initials: null }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error?.message ?? "Something went wrong");
        return;
      }

      setDisplayName(data.displayName);
      setSaved(null);
      setInitials("");
      setEditing(false);
    } catch {
      setError("Network error — try again");
    } finally {
      setSaving(false);
    }
  }, []);

  return (
    <div className="w-full">
      {/* Section header */}
      <div className="flex items-center gap-3 mb-3">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gold/8 to-transparent" />
        <div className="flex items-center gap-1.5">
          <div className="h-1 w-1 rounded-full bg-gold/30" />
          <span className="text-[11px] tracking-[0.2em] uppercase text-gold/30 font-mono">
            Your tag
          </span>
        </div>
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gold/8 to-transparent" />
      </div>

      <AnimatePresence mode="wait">
        {!editing ? (
          <motion.button
            key="display"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease }}
            onClick={() => setEditing(true)}
            className="w-full group flex items-center justify-center gap-2 py-2 px-4 rounded-lg
                       hover:bg-foreground/[0.03] transition-colors cursor-pointer"
          >
            {saved ? (
              <span className="text-xs text-foreground/60 font-mono tracking-wide">
                {displayName ?? saved}
              </span>
            ) : (
              <span className="text-xs text-gold/30 font-mono tracking-wide">
                Set your initials
              </span>
            )}
            <span className="text-[10px] text-gold/20 group-hover:text-gold/40 transition-colors">
              edit
            </span>
          </motion.button>
        ) : (
          <motion.div
            key="editor"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2, ease }}
            className="space-y-2"
          >
            <div className="flex items-center gap-2">
              <label htmlFor="initials-input" className="sr-only">
                Your initials (2–4 letters, shown on leaderboard)
              </label>
              <input
                id="initials-input"
                type="text"
                value={initials}
                onChange={(e) => {
                  // Allow only letters, max 4
                  const val = e.target.value.replace(/[^a-zA-Z]/g, "").slice(0, 4);
                  setInitials(val);
                  setError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !saving) handleSave();
                  if (e.key === "Escape") {
                    setInitials(saved ?? "");
                    setEditing(false);
                    setError(null);
                  }
                }}
                placeholder="AA"
                maxLength={4}
                autoFocus
                className="flex-1 bg-foreground/[0.04] border border-gold/10 rounded-md px-3 py-1.5
                           text-center text-sm font-mono uppercase tracking-widest text-foreground/80
                           placeholder:text-gold/15 focus:outline-none focus:border-gold/25
                           transition-colors"
              />
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-3 py-1.5 text-[11px] font-mono uppercase tracking-wider
                           bg-gold/10 text-gold/70 rounded-md
                           hover:bg-gold/15 hover:text-gold/90 transition-colors
                           disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {saving ? "..." : "Save"}
              </button>
              <button
                onClick={() => {
                  setInitials(saved ?? "");
                  setEditing(false);
                  setError(null);
                }}
                className="px-2 py-1.5 text-[11px] font-mono text-foreground/30
                           hover:text-foreground/60 transition-colors"
              >
                Esc
              </button>
            </div>

            {/* Help text + clear */}
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] text-gold/25 font-mono">
                2-4 letters. Shows on leaderboard.
              </span>
              {saved && (
                <button
                  onClick={handleClear}
                  disabled={saving}
                  className="text-[11px] text-foreground/30 hover:text-foreground/50
                             font-mono transition-colors disabled:opacity-40"
                >
                  clear
                </button>
              )}
            </div>

            {/* Error */}
            {error && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-xs text-red-400/80 text-center font-mono"
              >
                {error}
              </motion.p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
