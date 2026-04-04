"use client";

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RARITY_CONFIG, type Rarity } from "@/lib/fortunes";
import { saveToCollection } from "@/lib/collection";
import { ease } from "@/components/shared/animations";
import { fireRarityConfetti } from "@/components/shared/confetti";
import { OracleSpinner } from "@/components/shared/icons";
import Link from "next/link";

type FlowState =
  | { step: "sealed" }
  | { step: "claiming" }
  | { step: "revealing"; fortune: string; rarity: Rarity }
  | { step: "rarity-reveal"; fortune: string; rarity: Rarity }
  | { step: "fortune"; fortune: string; rarity: Rarity }
  | { step: "error"; message: string };

export function GiftClaimClient({
  token,
  rarity: giftRarity,
}: {
  token: string;
  rarity: Rarity;
}) {
  const [state, setState] = useState<FlowState>({ step: "sealed" });

  // "Revealing" → rarity-reveal transition
  useEffect(() => {
    if (state.step !== "revealing") return;
    const { fortune, rarity } = state;
    const timer = setTimeout(() => {
      setState({ step: "rarity-reveal", fortune, rarity });
    }, 800);
    return () => clearTimeout(timer);
  }, [state.step]); // eslint-disable-line react-hooks/exhaustive-deps

  // "Rarity-reveal" → fortune transition
  useEffect(() => {
    if (state.step !== "rarity-reveal") return;
    const { fortune, rarity } = state;
    const timer = setTimeout(() => {
      setState({ step: "fortune", fortune, rarity });
    }, 1500);
    return () => clearTimeout(timer);
  }, [state.step]); // eslint-disable-line react-hooks/exhaustive-deps

  // Confetti + collection on fortune reveal
  useEffect(() => {
    if (state.step !== "fortune") return;
    fireRarityConfetti(state.rarity);
    saveToCollection(state.fortune, state.rarity);
  }, [state.step]); // eslint-disable-line react-hooks/exhaustive-deps

  const claimGift = useCallback(async () => {
    setState({ step: "claiming" });
    try {
      const res = await fetch("/api/gift/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      if (res.ok) {
        const data = await res.json();
        setState({
          step: "revealing",
          fortune: data.fortune,
          rarity: data.rarity ?? "common",
        });
        return;
      }

      const data = await res.json().catch(() => null);
      setState({
        step: "error",
        message: data?.error?.message ?? "Failed to open gift",
      });
    } catch {
      setState({ step: "error", message: "Network error. Please try again." });
    }
  }, [token]);

  const rarityConfig = (state.step === "fortune" || state.step === "rarity-reveal")
    ? RARITY_CONFIG[state.rarity]
    : null;

  const sealedRarityConfig = RARITY_CONFIG[giftRarity];

  return (
    <main className="relative flex-1 flex flex-col items-center justify-center px-6 py-12 overflow-hidden">
      {/* Ambient glows */}
      <div className="pointer-events-none absolute inset-0 z-[1] flex flex-col">
        <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full bg-lacquer/[0.04] blur-[120px]" />
        <div className="absolute bottom-[-10%] left-1/2 -translate-x-1/2 w-[500px] h-[300px] rounded-full bg-gold/[0.03] blur-[100px]" />
      </div>

      <div className="relative z-[2] w-full max-w-sm">
        <AnimatePresence mode="wait">
          {/* SEALED */}
          {state.step === "sealed" && (
            <motion.div
              key="sealed"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.5, ease }}
              className="space-y-8"
            >
              {/* Sealed gift card */}
              <div className="relative rounded-2xl overflow-hidden scanlines rarity-common">
                <div className="absolute inset-0 bg-gradient-to-b from-lacquer/[0.06] via-[#0c0a0e] to-[#0c0a0e]" />
                <div className="absolute inset-0 bg-gradient-to-br from-gold/[0.02] via-transparent to-lacquer/[0.02]" />
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 dragon-line" />

                <div className="relative p-8 space-y-6 ornamental-border text-center">
                  <motion.div
                    animate={{
                      scale: [1, 1.05, 1],
                      rotate: [0, -2, 2, 0],
                    }}
                    transition={{
                      duration: 3,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                    className="text-5xl"
                  >
                    🎁
                  </motion.div>

                  <div className="space-y-2">
                    <h1 className="text-xl font-semibold text-foreground/90">
                      You received a fortune gift!
                    </h1>
                    <p className="text-sm text-gold/50">
                      Someone sent you a{" "}
                      <span style={{ color: sealedRarityConfig.color }} className="font-medium">
                        {sealedRarityConfig.label}
                      </span>{" "}
                      fortune from the oracle.
                    </p>
                  </div>

                  {/* Sealed mystery line */}
                  <motion.div
                    animate={{ scaleX: [0.3, 1, 0.3] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    className="w-24 mx-auto h-px bg-gradient-to-r from-transparent via-gold/30 to-transparent"
                  />

                  <div className="dragon-line w-full" />
                </div>
              </div>

              {/* Open CTA */}
              <button
                onClick={claimGift}
                className="btn-lacquer w-full h-14 rounded-xl text-sm font-semibold tracking-wide cursor-pointer transition-all active:scale-[0.98]"
              >
                Open Your Gift
              </button>

              <div className="flex items-center justify-center gap-4 text-[11px] tracking-[0.15em] uppercase font-mono">
                <span className="text-lacquer/50">Sealed</span>
                <div className="h-1 w-1 rounded-full bg-gold/20" />
                <span className="text-gold/35">Tap to reveal</span>
              </div>
            </motion.div>
          )}

          {/* CLAIMING */}
          {state.step === "claiming" && (
            <motion.div
              key="claiming"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.5, ease }}
              className="flex flex-col items-center gap-5 py-16"
            >
              <OracleSpinner />
              <p className="text-sm text-gold/50 tracking-wide">Opening your gift&hellip;</p>
            </motion.div>
          )}

          {/* REVEALING */}
          {state.step === "revealing" && (
            <motion.div
              key="revealing"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              transition={{ duration: 0.35, ease }}
              className="flex flex-col items-center gap-4 py-10"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="h-10 w-10 rounded-full bg-cyan/10 border border-cyan/20 flex items-center justify-center"
              >
                <svg className="h-5 w-5 text-cyan" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
              </motion.div>
              <div className="text-center space-y-1.5">
                <p className="text-sm font-medium text-foreground/90">Gift opened!</p>
                <p className="text-xs text-gold/40">Revealing your fortune&hellip;</p>
              </div>
              <motion.div
                animate={{ scaleX: [0.3, 1, 0.3] }}
                transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut" }}
                className="w-20 h-px bg-gradient-to-r from-transparent via-gold/30 to-transparent"
              />
            </motion.div>
          )}

          {/* RARITY REVEAL */}
          {state.step === "rarity-reveal" && (
            <motion.div
              key="rarity-reveal"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.1 }}
              transition={{ duration: 0.5, ease }}
              className="flex flex-col items-center justify-center gap-6 py-14"
            >
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 15 }}
                className="relative"
              >
                <div
                  className="absolute inset-0 rounded-full blur-xl"
                  style={{ background: rarityConfig?.glowColor, transform: "scale(2.5)" }}
                />
                <motion.div
                  initial={{ rotateY: 90 }}
                  animate={{ rotateY: 0 }}
                  transition={{ delay: 0.2, duration: 0.4, ease }}
                  className={`rarity-badge relative ${rarityConfig?.badgeClass} text-sm px-6 py-2.5`}
                >
                  <div className="h-2 w-2 rounded-full" style={{ backgroundColor: rarityConfig?.color }} />
                  <span className="tracking-[0.15em]">{rarityConfig?.label}</span>
                </motion.div>
              </motion.div>
              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: 0.4, duration: 0.6, ease }}
                className="w-24 h-px origin-center"
                style={{ background: `linear-gradient(90deg, transparent, ${rarityConfig?.color}40, transparent)` }}
              />
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5, duration: 0.4 }}
                className="text-xs text-gold/30 font-mono"
              >
                Cracking open&hellip;
              </motion.p>
            </motion.div>
          )}

          {/* FORTUNE REVEALED */}
          {state.step === "fortune" && (
            <motion.div
              key="fortune"
              initial={{ opacity: 0, scale: 0.92, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.7, ease }}
              className="space-y-6"
            >
              {/* Fortune card */}
              <div
                className={`relative rounded-2xl overflow-hidden scanlines ${
                  RARITY_CONFIG[state.rarity].borderClass
                } ${
                  state.rarity === "legendary" ? "rarity-legendary-border" :
                  state.rarity === "epic" ? "rarity-epic-border" : ""
                }`}
              >
                <div className="absolute inset-0 bg-gradient-to-b from-lacquer/[0.06] via-[#0c0a0e] to-[#0c0a0e]" />
                <div className="absolute inset-0 bg-gradient-to-br from-gold/[0.02] via-transparent to-lacquer/[0.02]" />
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 dragon-line" />

                <div className="relative p-8 space-y-6 ornamental-border">
                  {/* Gift badge */}
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1, duration: 0.4, ease }}
                    className="flex items-center justify-center gap-3"
                  >
                    <span className="text-xs text-gold/30 font-mono tracking-wide">GIFT</span>
                    <div className={`rarity-badge ${RARITY_CONFIG[state.rarity].badgeClass}`}>
                      <div
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: RARITY_CONFIG[state.rarity].color }}
                      />
                      {RARITY_CONFIG[state.rarity].label}
                    </div>
                  </motion.div>

                  {/* Cookie */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0, rotate: -10 }}
                    animate={{ opacity: 1, scale: 1, rotate: 0 }}
                    transition={{ delay: 0.2, duration: 0.5, ease }}
                    className="text-2xl drop-shadow-[0_0_12px_rgba(212,162,87,0.3)]"
                  >
                    🥠
                  </motion.div>

                  {/* Fortune text */}
                  <motion.blockquote
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4, duration: 0.6, ease }}
                    className={`text-lg leading-relaxed tracking-tight font-light ${
                      state.rarity === "legendary" ? "text-shimmer-gold" : "text-foreground/90"
                    }`}
                  >
                    {state.rarity !== "legendary" && <span className="text-gold/60">&ldquo;</span>}
                    {state.rarity === "legendary" ? `\u201C${state.fortune}\u201D` : state.fortune}
                    {state.rarity !== "legendary" && <span className="text-gold/60">&rdquo;</span>}
                  </motion.blockquote>

                  {/* Meta */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6, duration: 0.4 }}
                    className="flex items-center gap-3"
                  >
                    <div className="h-1 w-1 rounded-full bg-cyan/60 shadow-[0_0_6px_rgba(0,200,212,0.4)]" />
                    <span className="font-mono text-[11px] text-cyan/45">gifted</span>
                    <div className="h-px flex-1 bg-gradient-to-r from-gold/10 to-transparent" />
                    <span className="font-mono text-[11px] text-gold/30">200 sats</span>
                  </motion.div>

                  <motion.div
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ delay: 0.85, duration: 0.8, ease }}
                    className="dragon-line w-full origin-center"
                  />
                </div>
              </div>

              {/* Saved to collection notice */}
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.0, duration: 0.4 }}
                className="text-xs text-center text-gold/30"
              >
                Saved to your collection on this device.
              </motion.p>

              {/* CTAs */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8, duration: 0.5, ease }}
                className="space-y-3"
              >
                <Link
                  href="/"
                  className="btn-lacquer block w-full h-11 rounded-xl text-sm font-medium text-center leading-[2.75rem] cursor-pointer active:scale-[0.98]"
                >
                  Get Your Own Fortune
                </Link>
                <Link
                  href="/collection"
                  className="block w-full h-9 rounded-lg text-xs text-center leading-[2.25rem] text-gold/30 hover:text-gold/45 transition-colors"
                >
                  View collection
                </Link>
              </motion.div>
            </motion.div>
          )}

          {/* ERROR */}
          {state.step === "error" && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease }}
              className="space-y-4 py-10"
            >
              <div className="rounded-xl border border-lacquer/20 bg-lacquer/[0.04] p-5">
                <p className="text-sm text-lacquer/70">{state.message}</p>
              </div>
              <Link
                href="/"
                className="btn-jade block w-full h-10 rounded-xl text-sm text-center leading-10 cursor-pointer active:scale-[0.98]"
              >
                Back to Fortune Sats
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
