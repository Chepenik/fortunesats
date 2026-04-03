"use client";

import { Suspense, useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useCheckoutSuccess } from "@moneydevkit/nextjs";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Copy, Link2 } from "lucide-react";
import { getStreak, recordFortune, type StreakData } from "@/lib/streak";
import { saveToCollection } from "@/lib/collection";
import {
  pickVariant,
  buildXShareUrl,
  buildShareText,
  buildFortuneUrl,
  canNativeShare,
  nativeShare,
  trackShare,
  type ShareVariant,
} from "@/lib/share";
import { RARITY_CONFIG, type Rarity } from "@/lib/fortunes";
import { ease } from "@/components/shared/animations";
import { fireRarityConfetti } from "@/components/shared/confetti";
import { XIcon, OracleSpinner } from "@/components/shared/icons";
import Link from "next/link";

type FlowState =
  | { step: "verifying" }
  | { step: "delivering" }
  | { step: "revealing"; fortune: string; rarity: Rarity; timestamp: string }
  | { step: "rarity-reveal"; fortune: string; rarity: Rarity; timestamp: string }
  | { step: "fortune"; fortune: string; rarity: Rarity; timestamp: string }
  | { step: "error"; message: string };

export default function FortuneSuccessPage() {
  return (
    <Suspense
      fallback={
        <main className="flex-1 flex items-center justify-center px-6 py-12">
          <OracleSpinner />
        </main>
      }
    >
      <FortuneSuccessInner />
    </Suspense>
  );
}

function FortuneSuccessInner() {
  const searchParams = useSearchParams();
  const { isCheckoutPaid, isCheckoutPaidLoading } = useCheckoutSuccess();
  const [state, setState] = useState<FlowState>({ step: "verifying" });
  const [copied, setCopied] = useState<string | null>(null);
  const [hasNativeShare, setHasNativeShare] = useState(false);
  const [streak, setStreak] = useState<StreakData | null>(null);
  const variantRef = useRef<ShareVariant>(pickVariant());
  const deliveredRef = useRef(false);

  useEffect(() => {
    setHasNativeShare(canNativeShare()); // eslint-disable-line react-hooks/set-state-in-effect
    setStreak(getStreak());
  }, []);

  // Once MDK confirms payment, deliver the fortune
  useEffect(() => {
    if (isCheckoutPaidLoading || !isCheckoutPaid || deliveredRef.current) return;
    deliveredRef.current = true;

    setState({ step: "delivering" }); // eslint-disable-line react-hooks/set-state-in-effect

    // MDK appends the checkout ID as ?checkout-id=<id> on redirect
    const checkoutId = searchParams.get("checkout-id");
    if (!checkoutId) {
      setState({ step: "error", message: "Missing checkout reference. Please try again from the homepage." });
      return;
    }

    fetch("/api/fortune/deliver", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checkoutId }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error?.message ?? "Failed to deliver fortune");
        }
        return res.json();
      })
      .then((data) => {
        variantRef.current = pickVariant();
        setState({
          step: "revealing",
          fortune: data.fortune,
          rarity: data.rarity ?? "common",
          timestamp: data.timestamp,
        });
      })
      .catch((e) => {
        setState({ step: "error", message: e.message ?? "Something went wrong" });
      });
  }, [isCheckoutPaid, isCheckoutPaidLoading, searchParams]);

  // Handle payment not confirmed after loading finishes
  useEffect(() => {
    if (!isCheckoutPaidLoading && isCheckoutPaid === false) {
      setState({ step: "error", message: "Payment not confirmed. If you paid, please wait a moment and refresh." }); // eslint-disable-line react-hooks/set-state-in-effect
    }
  }, [isCheckoutPaidLoading, isCheckoutPaid]);

  // "Revealing" → rarity-reveal transition
  useEffect(() => {
    if (state.step !== "revealing") return;
    const { fortune, rarity, timestamp } = state;
    const timer = setTimeout(() => {
      setState({ step: "rarity-reveal", fortune, rarity, timestamp });
    }, 800);
    return () => clearTimeout(timer);
  }, [state.step]); // eslint-disable-line react-hooks/exhaustive-deps

  // "Rarity-reveal" → fortune transition
  useEffect(() => {
    if (state.step !== "rarity-reveal") return;
    const { fortune, rarity, timestamp } = state;
    const timer = setTimeout(() => {
      setState({ step: "fortune", fortune, rarity, timestamp });
    }, 1500);
    return () => clearTimeout(timer);
  }, [state.step]); // eslint-disable-line react-hooks/exhaustive-deps

  // Confetti + streak + collection on fortune reveal
  useEffect(() => {
    if (state.step !== "fortune") return;
    const updated = recordFortune();
    setStreak(updated); // eslint-disable-line react-hooks/set-state-in-effect
    fireRarityConfetti(state.rarity);
    saveToCollection(state.fortune, state.rarity);
  }, [state.step]); // eslint-disable-line react-hooks/exhaustive-deps

  const copyToClipboard = useCallback((text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  }, []);

  const shareOnX = useCallback((fortune: string, rarity: Rarity) => {
    const v = variantRef.current;
    trackShare("x_share", v.id);
    window.open(buildXShareUrl(fortune, v, rarity), "_blank", "noopener,noreferrer");
  }, []);

  const copyShareText = useCallback(
    (fortune: string, rarity: Rarity) => {
      const v = variantRef.current;
      trackShare("copy_text", v.id);
      copyToClipboard(buildShareText(fortune, v, rarity), "text");
    },
    [copyToClipboard],
  );

  const copyLink = useCallback((fortune: string, rarity: Rarity) => {
    trackShare("copy_link", variantRef.current.id);
    copyToClipboard(buildFortuneUrl(fortune, rarity), "link");
  }, [copyToClipboard]);

  const handleNativeShare = useCallback(async (fortune: string, rarity: Rarity) => {
    const v = variantRef.current;
    trackShare("native_share", v.id);
    await nativeShare(fortune, v, rarity);
  }, []);

  const rarityConfig = (state.step === "fortune" || state.step === "rarity-reveal")
    ? RARITY_CONFIG[state.rarity]
    : null;

  return (
    <main className="relative flex-1 flex flex-col items-center justify-center px-6 py-12 overflow-hidden">
      {/* Ambient glows */}
      <div className="pointer-events-none absolute inset-0 z-[1] flex flex-col">
        <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full bg-lacquer/[0.04] blur-[120px]" />
        <div className="absolute bottom-[-10%] left-1/2 -translate-x-1/2 w-[500px] h-[300px] rounded-full bg-gold/[0.03] blur-[100px]" />
      </div>

      <div className="relative z-[2] w-full max-w-sm">
        <AnimatePresence mode="wait">
          {/* VERIFYING / DELIVERING */}
          {(state.step === "verifying" || state.step === "delivering") && (
            <motion.div
              key="loading"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.5, ease }}
              className="flex flex-col items-center gap-5 py-16"
            >
              <OracleSpinner />
              <p className="text-sm text-gold/50 tracking-wide">
                {state.step === "verifying"
                  ? "Verifying payment\u2026"
                  : "Consulting the oracle\u2026"}
              </p>
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
                <p className="text-sm font-medium text-foreground/90">Payment received</p>
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
              exit={{ opacity: 0, scale: 0.97 }}
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
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1, duration: 0.4, ease }}
                    className="flex items-center justify-center"
                  >
                    <div className={`rarity-badge ${RARITY_CONFIG[state.rarity].badgeClass}`}>
                      <div
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: RARITY_CONFIG[state.rarity].color }}
                      />
                      {RARITY_CONFIG[state.rarity].label}
                    </div>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, scale: 0, rotate: -10 }}
                    animate={{ opacity: 1, scale: 1, rotate: 0 }}
                    transition={{ delay: 0.2, duration: 0.5, ease }}
                    className="text-2xl drop-shadow-[0_0_12px_rgba(212,162,87,0.3)]"
                  >
                    🥠
                  </motion.div>

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

                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6, duration: 0.4 }}
                    className="flex items-center gap-3"
                  >
                    <div className="h-1 w-1 rounded-full bg-cyan/60 shadow-[0_0_6px_rgba(0,200,212,0.4)]" />
                    <span className="font-mono text-[11px] text-cyan/45">
                      {new Date(state.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <div className="h-px flex-1 bg-gradient-to-r from-gold/10 to-transparent" />
                    <span className="font-mono text-[11px] text-gold/30">100 sats</span>
                  </motion.div>

                  {streak && streak.current > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.7, duration: 0.5, ease }}
                      className="flex items-center justify-center gap-2"
                    >
                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-ember/[0.08] border border-ember/15">
                        <span className="text-sm">🔥</span>
                        <span className="font-mono text-xs text-ember/80 font-medium">
                          {streak.current}-day streak
                        </span>
                      </div>
                      {streak.total > 1 && (
                        <span className="font-mono text-[10px] text-gold/25">{streak.total} total</span>
                      )}
                    </motion.div>
                  )}

                  <motion.div
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ delay: 0.85, duration: 0.8, ease }}
                    className="dragon-line w-full origin-center"
                  />
                </div>
              </div>

              {/* Share module */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8, duration: 0.5, ease }}
                className="space-y-3"
              >
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gold/10 to-transparent" />
                  <span className="text-[11px] tracking-[0.2em] uppercase text-gold/30 font-mono">
                    Share your fortune
                  </span>
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gold/10 to-transparent" />
                </div>

                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.9, duration: 0.4, ease }}
                >
                  <button
                    onClick={() => shareOnX(state.fortune, state.rarity)}
                    className="btn-lacquer w-full h-11 rounded-xl text-sm font-medium cursor-pointer active:scale-[0.98] flex items-center justify-center gap-2.5"
                  >
                    <XIcon className="h-3.5 w-3.5" />
                    Share on X
                  </button>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.0, duration: 0.4, ease }}
                  className="flex gap-2"
                >
                  <button
                    className="btn-jade flex-1 h-9 rounded-lg text-xs font-medium cursor-pointer active:scale-[0.98] flex items-center justify-center gap-1.5"
                    onClick={() => copyShareText(state.fortune, state.rarity)}
                  >
                    <span className="relative h-3 w-3">
                      <span className={`absolute inset-0 transition-all duration-200 ${copied === "text" ? "scale-0 opacity-0" : "scale-100 opacity-100"}`}>
                        <Copy className="h-3 w-3" />
                      </span>
                      <span className={`absolute inset-0 transition-all duration-200 ${copied === "text" ? "scale-100 opacity-100" : "scale-0 opacity-0"}`}>
                        <Check className="h-3 w-3 text-cyan" />
                      </span>
                    </span>
                    {copied === "text" ? "Copied!" : "Copy text"}
                  </button>
                  <button
                    className="btn-jade flex-1 h-9 rounded-lg text-xs font-medium cursor-pointer active:scale-[0.98] flex items-center justify-center gap-1.5"
                    onClick={() => copyLink(state.fortune, state.rarity)}
                  >
                    <span className="relative h-3 w-3">
                      <span className={`absolute inset-0 transition-all duration-200 ${copied === "link" ? "scale-0 opacity-0" : "scale-100 opacity-100"}`}>
                        <Link2 className="h-3 w-3" />
                      </span>
                      <span className={`absolute inset-0 transition-all duration-200 ${copied === "link" ? "scale-100 opacity-100" : "scale-0 opacity-0"}`}>
                        <Check className="h-3 w-3 text-cyan" />
                      </span>
                    </span>
                    {copied === "link" ? "Copied!" : "Copy link"}
                  </button>
                </motion.div>

                {hasNativeShare && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1.1, duration: 0.3 }}
                  >
                    <button
                      className="w-full h-9 rounded-lg text-xs text-gold/30 hover:text-gold/45 transition-colors cursor-pointer"
                      onClick={() => handleNativeShare(state.fortune, state.rarity)}
                    >
                      More sharing options&hellip;
                    </button>
                  </motion.div>
                )}
              </motion.div>

              {/* Another Fortune */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.2, duration: 0.4 }}
              >
                <Link
                  href="/"
                  className="block w-full h-11 rounded-xl text-sm text-center leading-[2.75rem] text-muted-foreground/40 hover:text-gold/50 transition-colors"
                >
                  Another Fortune
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
              exit={{ opacity: 0, y: -10 }}
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
