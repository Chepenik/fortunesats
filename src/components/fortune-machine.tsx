"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
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
import { ease, fadeUp, scaleFade } from "@/components/shared/animations";
import { fireRarityConfetti } from "@/components/shared/confetti";
import { XIcon, GoldDot, OracleSpinner } from "@/components/shared/icons";

/* ─── Types ──────────────────────────────────────────────── */

type FlowState =
  | { step: "idle" }
  | { step: "requesting" }
  | {
      step: "invoice";
      invoice: string;
      macaroon: string;
      paymentHash: string;
      amountSats: number;
    }
  | { step: "revealing"; fortune: string; rarity: Rarity; timestamp: string }
  | { step: "rarity-reveal"; fortune: string; rarity: Rarity; timestamp: string }
  | { step: "fortune"; fortune: string; rarity: Rarity; timestamp: string }
  | { step: "error"; message: string };

/* ─── Component ──────────────────────────────────────────── */

export function FortuneMachine({ freePromo = false }: { freePromo?: boolean }) {
  const [state, setState] = useState<FlowState>({ step: "idle" });
  const [copied, setCopied] = useState<string | null>(null);
  const [hasNativeShare, setHasNativeShare] = useState(false);
  const [waitingSecs, setWaitingSecs] = useState(0);
  const [checking, setChecking] = useState(false);
  const [checkMsg, setCheckMsg] = useState<string | null>(null);
  const [streak, setStreak] = useState<StreakData | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const variantRef = useRef<ShareVariant>(pickVariant());
  const paymentHashRef = useRef<string | null>(null);

  useEffect(() => {
    setHasNativeShare(canNativeShare());
    setStreak(getStreak());
  }, []);

  /* ── Elapsed timer for invoice state ── */
  useEffect(() => {
    if (state.step !== "invoice") {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setWaitingSecs(0);
      setCheckMsg(null);
      setChecking(false);
      return;
    }
    timerRef.current = setInterval(() => {
      setWaitingSecs((s) => s + 1);
    }, 1000);
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [state.step]);

  /* ── Manual payment check (replaces polling) ── */
  const checkPaymentStatus = useCallback(async () => {
    if (state.step !== "invoice") return;
    setChecking(true);
    setCheckMsg(null);
    try {
      const res = await fetch(
        `/api/fortune/status?paymentHash=${encodeURIComponent(state.paymentHash)}`,
      );
      if (res.ok) {
        const data = await res.json();
        if (data.paid) {
          variantRef.current = pickVariant();
          setState({
            step: "revealing",
            fortune: data.fortune,
            rarity: data.rarity ?? "common",
            timestamp: data.timestamp,
          });
          return;
        }
      }
      setCheckMsg("Not confirmed yet \u2014 Lightning takes a moment. Try again in a few seconds.");
    } catch {
      setCheckMsg("Could not reach server. Please try again.");
    } finally {
      setChecking(false);
    }
  }, [state]);

  /* ── "Revealing" → rarity-reveal transition ── */
  useEffect(() => {
    if (state.step !== "revealing") return;
    const { fortune, rarity, timestamp } = state;
    const timer = setTimeout(() => {
      setState({ step: "rarity-reveal", fortune, rarity, timestamp });
    }, 800);
    return () => clearTimeout(timer);
  }, [state.step]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── "Rarity-reveal" → fortune transition (1.5s dramatic pause) ── */
  useEffect(() => {
    if (state.step !== "rarity-reveal") return;
    const { fortune, rarity, timestamp } = state;
    const timer = setTimeout(() => {
      setState({ step: "fortune", fortune, rarity, timestamp });
    }, 1500);
    return () => clearTimeout(timer);
  }, [state.step]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Confetti + streak + collection on fortune reveal ── */
  useEffect(() => {
    if (state.step !== "fortune") return;
    const updated = recordFortune();
    setStreak(updated);
    fireRarityConfetti(state.rarity);
    saveToCollection(state.fortune, state.rarity);
  }, [state.step]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Request fortune ── */
  const requestFortune = useCallback(async () => {
    setState({ step: "requesting" });
    try {
      const res = await fetch("/api/fortune");
      if (res.status === 402) {
        const data = await res.json();
        paymentHashRef.current = data.paymentHash;
        setState({
          step: "invoice",
          invoice: data.invoice,
          macaroon: data.macaroon,
          paymentHash: data.paymentHash,
          amountSats: data.amountSats,
        });
        return;
      }
      if (res.ok) {
        const data = await res.json();
        variantRef.current = pickVariant();
        setState({
          step: "revealing",
          fortune: data.fortune,
          rarity: data.rarity ?? "common",
          timestamp: data.timestamp,
        });
        return;
      }
      setState({ step: "error", message: "Something went wrong. Please try again." });
    } catch (e) {
      setState({
        step: "error",
        message: e instanceof Error ? e.message : "Network error",
      });
    }
  }, []);

  /* ── WebLN payment ── */
  const payWithWebLN = useCallback(
    async (invoice: string, macaroon: string) => {
      try {
        if (typeof window !== "undefined" && "webln" in window) {
          const webln = (
            window as unknown as {
              webln: {
                enable: () => Promise<void>;
                sendPayment: (
                  invoice: string,
                ) => Promise<{ preimage: string }>;
              };
            }
          ).webln;
          await webln.enable();
          const { preimage } = await webln.sendPayment(invoice);
          const res = await fetch("/api/fortune", {
            headers: { Authorization: `L402 ${macaroon}:${preimage}` },
          });
          if (res.ok) {
            const data = await res.json();
            variantRef.current = pickVariant();
            setState({
              step: "revealing",
              fortune: data.fortune,
              rarity: data.rarity ?? "common",
              timestamp: data.timestamp,
            });
            return;
          }
          setState({
            step: "error",
            message: "Something went wrong after payment. Please try again.",
          });
        }
      } catch (e) {
        setState({
          step: "error",
          message: e instanceof Error ? e.message : "Payment failed",
        });
      }
    },
    [],
  );

  /* ── Clipboard ── */
  const copyToClipboard = useCallback((text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  }, []);

  /* ── Manual claim (fallback for broken webhook) ── */
  const claimFortune = useCallback(async () => {
    const hash = paymentHashRef.current;
    try {
      const url = hash
        ? `/api/fortune/claim?paymentHash=${encodeURIComponent(hash)}`
        : "/api/fortune/claim";
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        variantRef.current = pickVariant();
        setState({
          step: "revealing",
          fortune: data.fortune,
          rarity: data.rarity ?? "common",
          timestamp: data.timestamp,
        });
        return;
      }
    } catch { /* fall through */ }
    variantRef.current = pickVariant();
    setState({
      step: "revealing",
      fortune: "The path forward is revealed to those who take the first step.",
      rarity: "common",
      timestamp: new Date().toISOString(),
    });
  }, []);

  /* ── Share handlers ── */
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

  /* ── Rarity-dependent styles ── */
  const rarityConfig = (state.step === "fortune" || state.step === "rarity-reveal")
    ? RARITY_CONFIG[state.rarity]
    : null;

  return (
    <div className="w-full">
      <AnimatePresence mode="wait">
        {/* ────────────────── IDLE ────────────────── */}
        {state.step === "idle" && (
          <motion.div key="idle" {...fadeUp} className="space-y-8">
            {/* Main CTA */}
            <button
              onClick={requestFortune}
              className="btn-lacquer w-full h-14 rounded-xl text-sm font-semibold tracking-wide cursor-pointer transition-all active:scale-[0.98] active:translate-y-0"
            >
              {freePromo ? "Get Your Free Fortune" : "Get Your Fortune"}
            </button>

            {/* Flow steps */}
            {freePromo ? (
              <div className="flex items-center justify-center gap-4 text-[10px] tracking-[0.15em] uppercase font-mono">
                <span className="text-cyan/50">Request</span>
                <GoldDot />
                <span className="text-gold/30">Fortune</span>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-4 text-[10px] tracking-[0.15em] uppercase font-mono">
                <span className="text-lacquer/50">Request</span>
                <GoldDot />
                <span className="text-gold/30">Invoice</span>
                <GoldDot />
                <span className="text-gold/30">Pay</span>
                <GoldDot />
                <span className="text-gold/30">Fortune</span>
              </div>
            )}

            {/* Streak display */}
            {streak && streak.current > 0 && (
              <div className="space-y-2.5 pt-1">
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gold/8 to-transparent" />
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm">🔥</span>
                    <span className="font-mono text-xs text-ember/70 font-medium">
                      {streak.current}-day streak
                    </span>
                    {streak.best > streak.current && (
                      <span className="font-mono text-[10px] text-gold/25">
                        (best: {streak.best})
                      </span>
                    )}
                  </div>
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gold/8 to-transparent" />
                </div>
                <p className="text-[10px] text-center text-gold/20 leading-relaxed">
                  Your streak lives on this device &mdash; a personal ritual, just for you.
                </p>
              </div>
            )}
          </motion.div>
        )}

        {/* ────────────────── REQUESTING ────────────────── */}
        {state.step === "requesting" && (
          <motion.div key="requesting" {...fadeUp} className="space-y-5">
            <div className="flex flex-col items-center gap-5 py-10">
              <OracleSpinner />
              <p className="text-sm text-gold/50 tracking-wide">
                Consulting the oracle&hellip;
              </p>
            </div>
          </motion.div>
        )}

        {/* ────────────────── INVOICE ────────────────── */}
        {state.step === "invoice" && (
          <motion.div key="invoice" {...scaleFade} className="space-y-5">
            <div className="lacquer-surface rounded-2xl p-6 space-y-5 ornamental-border">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-lacquer animate-glow-pulse" />
                  <span className="text-xs text-gold/50 font-mono tracking-wide">
                    Scan QR &middot; Pay &middot; Tap confirm
                  </span>
                </div>
                <span className="font-mono text-xs text-ember/60">
                  {state.amountSats} sats
                </span>
              </div>

              {/* QR Code */}
              <div className="flex justify-center">
                <div className="rounded-xl bg-[#f0ece4] p-4 glow-gold">
                  <QRCodeSVG
                    value={state.invoice.toUpperCase()}
                    size={180}
                    level="M"
                    bgColor="transparent"
                    fgColor="#0c0a0e"
                  />
                </div>
              </div>

              {/* Invoice string */}
              <button
                onClick={() => copyToClipboard(state.invoice, "invoice")}
                className="w-full group cursor-pointer"
              >
                <div className="font-mono text-[9px] leading-relaxed text-gold/25 group-hover:text-gold/40 transition-colors line-clamp-2 text-center">
                  {state.invoice}
                </div>
                <div className="text-[10px] text-lacquer/40 mt-1 group-hover:text-lacquer/60 transition-colors">
                  {copied === "invoice" ? "Copied!" : "Tap to copy"}
                </div>
              </button>

              {/* Status indicator */}
              <div className="flex items-center justify-center gap-2">
                <div className="h-px flex-1 bg-gold/5" />
                <span className="font-mono text-[9px] text-gold/20">
                  {waitingSecs > 3
                    ? `Waiting ${waitingSecs}s\u2026`
                    : "Invoice created \u2014 awaiting payment"}
                </span>
                <div className="h-px flex-1 bg-gold/5" />
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2">
              <button
                onClick={() => payWithWebLN(state.invoice, state.macaroon)}
                className="btn-lacquer w-full h-11 rounded-xl text-sm font-medium cursor-pointer active:scale-[0.98]"
              >
                ⚡ Pay with Lightning Wallet
              </button>
              <button
                className="w-full h-9 rounded-lg text-xs text-gold/40 hover:text-gold/60 transition-colors cursor-pointer"
                onClick={() => copyToClipboard(state.invoice, "invoice")}
              >
                {copied === "invoice" ? "Copied to clipboard" : "Copy invoice"}
              </button>
            </div>

            {/* Manual payment check — replaces auto-polling */}
            <div className="space-y-2">
              <button
                onClick={checkPaymentStatus}
                disabled={checking}
                className="btn-jade w-full h-11 rounded-xl text-sm font-medium cursor-pointer active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {checking ? "Checking\u2026" : "I\u2019ve Paid \u2014 Check Now"}
              </button>
              {checkMsg && (
                <p className="text-[10px] text-center text-gold/30 leading-relaxed">
                  {checkMsg}
                </p>
              )}
              {waitingSecs > 8 && !checkMsg && (
                <p className="text-[10px] text-center text-gold/20 leading-relaxed">
                  Paid already? Tap the button above to check payment status.
                </p>
              )}
            </div>

            {/* Direct claim fallback — covers webhook propagation delays */}
            {waitingSecs > 15 && (
              <div className="space-y-2">
                <div className="rounded-xl border border-gold/8 bg-gold/[0.02] p-3 space-y-2">
                  <p className="text-[11px] text-gold/40 font-medium">
                    Payment not detected?
                  </p>
                  <p className="text-[10px] text-gold/25 leading-relaxed">
                    Lightning confirmations can take a moment to propagate across nodes.
                    If your wallet shows the payment as sent, tap below to claim your fortune directly.
                  </p>
                  <button
                    onClick={claimFortune}
                    className="btn-jade w-full h-10 rounded-xl text-xs font-medium cursor-pointer active:scale-[0.98]"
                  >
                    Claim Fortune Directly
                  </button>
                </div>
              </div>
            )}

            {/* Cancel */}
            <div className="text-center">
              <button
                onClick={() => setState({ step: "idle" })}
                className="text-[11px] text-muted-foreground/30 hover:text-lacquer/50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        )}

        {/* ────────────────── REVEALING (payment success → rarity reveal) ────────────────── */}
        {state.step === "revealing" && (
          <motion.div
            key="revealing"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            transition={{ duration: 0.35, ease }}
            className="flex flex-col items-center gap-4 py-10"
          >
            {/* Success indicator */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="h-10 w-10 rounded-full bg-cyan/10 border border-cyan/20 flex items-center justify-center"
            >
              <svg className="h-5 w-5 text-cyan" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
            </motion.div>

            <div className="text-center space-y-1.5">
              <p className="text-sm font-medium text-foreground/90">
                Payment received
              </p>
              <p className="text-xs text-gold/40">
                Revealing your fortune&hellip;
              </p>
            </div>

            <motion.div
              animate={{ scaleX: [0.3, 1, 0.3] }}
              transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut" }}
              className="w-20 h-px bg-gradient-to-r from-transparent via-gold/30 to-transparent"
            />
          </motion.div>
        )}

        {/* ────────────────── RARITY REVEAL (dramatic badge moment) ────────────────── */}
        {state.step === "rarity-reveal" && (
          <motion.div
            key="rarity-reveal"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            transition={{ duration: 0.5, ease }}
            className="flex flex-col items-center justify-center gap-6 py-14"
          >
            {/* Rarity glow ring */}
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 15 }}
              className="relative"
            >
              {/* Outer glow */}
              <div
                className="absolute inset-0 rounded-full blur-xl"
                style={{
                  background: rarityConfig?.glowColor,
                  transform: "scale(2.5)",
                }}
              />
              {/* Badge */}
              <motion.div
                initial={{ rotateY: 90 }}
                animate={{ rotateY: 0 }}
                transition={{ delay: 0.2, duration: 0.4, ease }}
                className={`rarity-badge relative ${rarityConfig?.badgeClass} text-sm px-6 py-2.5`}
              >
                <div
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: rarityConfig?.color }}
                />
                <span className="tracking-[0.15em]">{rarityConfig?.label}</span>
              </motion.div>
            </motion.div>

            {/* Pulse line */}
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: 0.4, duration: 0.6, ease }}
              className="w-24 h-px origin-center"
              style={{
                background: `linear-gradient(90deg, transparent, ${rarityConfig?.color}40, transparent)`,
              }}
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

        {/* ────────────────── FORTUNE REVEALED ────────────────── */}
        {state.step === "fortune" && (
          <motion.div
            key="fortune"
            initial={{ opacity: 0, scale: 0.92, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.7, ease }}
            className="space-y-6"
          >
            {/* ── Fortune card ── */}
            <div
              className={`relative rounded-2xl overflow-hidden scanlines ${
                RARITY_CONFIG[state.rarity].borderClass
              } ${
                state.rarity === "legendary" ? "rarity-legendary-border" :
                state.rarity === "epic" ? "rarity-epic-border" : ""
              }`}
            >
              {/* Lacquer gradient background */}
              <div className="absolute inset-0 bg-gradient-to-b from-lacquer/[0.06] via-[#0c0a0e] to-[#0c0a0e]" />
              <div className="absolute inset-0 bg-gradient-to-br from-gold/[0.02] via-transparent to-lacquer/[0.02]" />

              {/* Top ornamental line */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 dragon-line" />

              <div className="relative p-8 space-y-6 ornamental-border">
                {/* Rarity badge */}
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

                {/* Cookie with glow */}
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
                    state.rarity === "legendary"
                      ? "text-shimmer-gold"
                      : "text-foreground/90"
                  }`}
                >
                  {state.rarity !== "legendary" && <span className="text-gold/60">&ldquo;</span>}
                  {state.rarity === "legendary" ? `\u201C${state.fortune}\u201D` : state.fortune}
                  {state.rarity !== "legendary" && <span className="text-gold/60">&rdquo;</span>}
                </motion.blockquote>

                {/* Meta line */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6, duration: 0.4 }}
                  className="flex items-center gap-3"
                >
                  <div className="h-1 w-1 rounded-full bg-cyan/60 shadow-[0_0_6px_rgba(0,200,212,0.4)]" />
                  <span className="font-mono text-[10px] text-cyan/40">
                    {new Date(state.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <div className="h-px flex-1 bg-gradient-to-r from-gold/10 to-transparent" />
                  <span className="font-mono text-[10px] text-gold/20">
                    {freePromo ? "free" : "100 sats"}
                  </span>
                </motion.div>

                {/* Streak badge */}
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
                      <span className="font-mono text-[10px] text-gold/25">
                        {streak.total} total
                      </span>
                    )}
                  </motion.div>
                )}

                {/* Bottom ornamental line */}
                <motion.div
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: 0.85, duration: 0.8, ease }}
                  className="dragon-line w-full origin-center"
                />
              </div>
            </div>

            {/* ── Share module ── */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8, duration: 0.5, ease }}
              className="space-y-3"
            >
              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gold/10 to-transparent" />
                <span className="text-[9px] tracking-[0.2em] uppercase text-gold/25 font-mono">
                  Share your fortune
                </span>
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gold/10 to-transparent" />
              </div>

              {/* Share on X — primary */}
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

              {/* Copy text / Copy link */}
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
                    <span
                      className={`absolute inset-0 transition-all duration-200 ${
                        copied === "text" ? "scale-0 opacity-0" : "scale-100 opacity-100"
                      }`}
                    >
                      <Copy className="h-3 w-3" />
                    </span>
                    <span
                      className={`absolute inset-0 transition-all duration-200 ${
                        copied === "text" ? "scale-100 opacity-100" : "scale-0 opacity-0"
                      }`}
                    >
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
                    <span
                      className={`absolute inset-0 transition-all duration-200 ${
                        copied === "link" ? "scale-0 opacity-0" : "scale-100 opacity-100"
                      }`}
                    >
                      <Link2 className="h-3 w-3" />
                    </span>
                    <span
                      className={`absolute inset-0 transition-all duration-200 ${
                        copied === "link" ? "scale-100 opacity-100" : "scale-0 opacity-0"
                      }`}
                    >
                      <Check className="h-3 w-3 text-cyan" />
                    </span>
                  </span>
                  {copied === "link" ? "Copied!" : "Copy link"}
                </button>
              </motion.div>

              {/* Native share */}
              {hasNativeShare && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.1, duration: 0.3 }}
                >
                  <button
                    className="w-full h-9 rounded-lg text-xs text-gold/25 hover:text-gold/40 transition-colors cursor-pointer"
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
              <button
                onClick={() => setState({ step: "idle" })}
                className="w-full h-11 rounded-xl text-sm text-muted-foreground/30 hover:text-gold/40 transition-colors cursor-pointer"
              >
                Another Fortune
              </button>
            </motion.div>
          </motion.div>
        )}

        {/* ────────────────── ERROR ────────────────── */}
        {state.step === "error" && (
          <motion.div key="error" {...fadeUp} className="space-y-4">
            <div className="rounded-xl border border-lacquer/20 bg-lacquer/[0.04] p-5">
              <p className="text-sm text-lacquer/70">{state.message}</p>
            </div>
            <button
              onClick={() => setState({ step: "idle" })}
              className="btn-jade w-full h-10 rounded-xl text-sm cursor-pointer active:scale-[0.98]"
            >
              Try Again
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

