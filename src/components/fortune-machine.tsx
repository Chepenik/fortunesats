"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { QRCodeSVG } from "qrcode.react";

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
  | { step: "fortune"; fortune: string; timestamp: string }
  | { step: "error"; message: string };

/* ─── Animation config ───────────────────────────────────── */

const ease = [0.23, 1, 0.32, 1] as const;

const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.45, ease },
};

const scaleFade = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.98 },
  transition: { duration: 0.5, ease },
};

/* ─── Component ──────────────────────────────────────────── */

export function FortuneMachine() {
  const [state, setState] = useState<FlowState>({ step: "idle" });
  const [copied, setCopied] = useState<"invoice" | "fortune" | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ── Poll for external wallet payment ── */
  useEffect(() => {
    if (state.step !== "invoice") {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }

    const { paymentHash } = state;

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/fortune/status?paymentHash=${encodeURIComponent(paymentHash)}`,
        );
        if (!res.ok) return;
        const data = await res.json();
        if (data.paid) {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          setState({
            step: "fortune",
            fortune: data.fortune,
            timestamp: data.timestamp,
          });
        }
      } catch {
        // silently retry
      }
    }, 2000);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [state]);

  /* ── Request fortune (triggers 402) ── */
  const requestFortune = useCallback(async () => {
    setState({ step: "requesting" });
    try {
      const res = await fetch("/api/fortune");
      if (res.status === 402) {
        const data = await res.json();
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
        setState({
          step: "fortune",
          fortune: data.fortune,
          timestamp: data.timestamp,
        });
        return;
      }
      setState({ step: "error", message: `Unexpected response: ${res.status}` });
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
            setState({
              step: "fortune",
              fortune: data.fortune,
              timestamp: data.timestamp,
            });
            return;
          }
          setState({
            step: "error",
            message: `Payment accepted but fortune failed: ${res.status}`,
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

  /* ── Copy helper ── */
  const copyText = useCallback((text: string, type: "invoice" | "fortune") => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  }, []);

  /* ── Share helper ── */
  const shareFortune = useCallback((fortune: string) => {
    const text = `"${fortune}"\n\n— Fortune Sats (100 sats, one fortune)`;
    if (navigator.share) {
      navigator.share({ text }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text);
      setCopied("fortune");
      setTimeout(() => setCopied(null), 2000);
    }
  }, []);

  return (
    <div className="w-full">
      <AnimatePresence mode="wait">
        {/* ── IDLE ── */}
        {state.step === "idle" && (
          <motion.div key="idle" {...fadeUp} className="space-y-6">
            <Button
              onClick={requestFortune}
              className="w-full h-12 text-sm font-medium tracking-wide cursor-pointer"
            >
              Get Your Fortune
            </Button>

            <div className="flex items-center justify-center gap-6 text-[11px] tracking-widest uppercase text-muted-foreground/50">
              <span>Request</span>
              <Dot />
              <span>Invoice</span>
              <Dot />
              <span>Pay</span>
              <Dot />
              <span>Fortune</span>
            </div>
          </motion.div>
        )}

        {/* ── REQUESTING ── */}
        {state.step === "requesting" && (
          <motion.div key="requesting" {...fadeUp} className="space-y-5">
            <div className="flex flex-col items-center gap-4 py-8">
              <Spinner />
              <p className="text-sm text-muted-foreground">
                Preparing your fortune...
              </p>
            </div>
          </motion.div>
        )}

        {/* ── INVOICE ── */}
        {state.step === "invoice" && (
          <motion.div key="invoice" {...scaleFade} className="space-y-5">
            <div className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm p-6 space-y-5">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                  <span className="text-xs text-muted-foreground">
                    Waiting for payment
                  </span>
                </div>
                <span className="font-mono text-xs text-muted-foreground/60">
                  {state.amountSats} sats
                </span>
              </div>

              {/* QR Code */}
              <div className="flex justify-center">
                <div className="rounded-xl bg-white p-4 shadow-sm">
                  <QRCodeSVG
                    value={state.invoice.toUpperCase()}
                    size={180}
                    level="M"
                    bgColor="transparent"
                  />
                </div>
              </div>

              {/* Invoice string */}
              <button
                onClick={() => copyText(state.invoice, "invoice")}
                className="w-full group cursor-pointer"
              >
                <div className="font-mono text-[9px] leading-relaxed text-muted-foreground/40 group-hover:text-muted-foreground/60 transition-colors line-clamp-2 text-center">
                  {state.invoice}
                </div>
                <div className="text-[10px] text-muted-foreground/30 mt-1 group-hover:text-muted-foreground/50 transition-colors">
                  {copied === "invoice" ? "Copied!" : "Tap to copy"}
                </div>
              </button>
            </div>

            {/* Actions */}
            <div className="space-y-2">
              <Button
                onClick={() => payWithWebLN(state.invoice, state.macaroon)}
                className="w-full h-11 text-sm cursor-pointer"
              >
                Pay with WebLN
              </Button>
              <Button
                variant="ghost"
                className="w-full h-9 text-xs text-muted-foreground cursor-pointer"
                onClick={() => copyText(state.invoice, "invoice")}
              >
                {copied === "invoice" ? "Copied to clipboard" : "Copy invoice"}
              </Button>
            </div>

            {/* Cancel */}
            <div className="text-center">
              <button
                onClick={() => setState({ step: "idle" })}
                className="text-[11px] text-muted-foreground/40 hover:text-muted-foreground/60 transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        )}

        {/* ── FORTUNE REVEALED ── */}
        {state.step === "fortune" && (
          <motion.div
            key="fortune"
            initial={{ opacity: 0, scale: 0.94, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.6, ease }}
            className="space-y-6"
          >
            {/* Fortune card */}
            <div className="relative rounded-2xl border border-warm-muted/20 bg-gradient-to-b from-card via-card to-card/80 p-8 space-y-6 overflow-hidden">
              {/* Subtle glow */}
              <div className="absolute inset-0 bg-gradient-to-br from-warm/[0.03] via-transparent to-warm/[0.02] pointer-events-none" />

              <div className="relative space-y-5">
                {/* Sparkle */}
                <motion.div
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2, duration: 0.4, ease }}
                  className="text-warm/60 text-sm"
                >
                  🥠
                </motion.div>

                {/* Fortune text */}
                <motion.blockquote
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3, duration: 0.5, ease }}
                  className="text-lg leading-relaxed tracking-tight font-light"
                >
                  &ldquo;{state.fortune}&rdquo;
                </motion.blockquote>

                {/* Meta */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5, duration: 0.4 }}
                  className="flex items-center gap-2"
                >
                  <div className="h-1 w-1 rounded-full bg-success" />
                  <span className="font-mono text-[10px] text-muted-foreground/50">
                    {new Date(state.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </motion.div>
              </div>
            </div>

            {/* Actions */}
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.4, ease }}
              className="space-y-3"
            >
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 h-9 text-xs cursor-pointer"
                  onClick={() => copyText(state.fortune, "fortune")}
                >
                  {copied === "fortune" ? "Copied!" : "Copy"}
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 h-9 text-xs cursor-pointer"
                  onClick={() => shareFortune(state.fortune)}
                >
                  Share
                </Button>
              </div>

              <Button
                onClick={() => setState({ step: "idle" })}
                className="w-full h-11 text-sm cursor-pointer"
              >
                Another Fortune
              </Button>
            </motion.div>
          </motion.div>
        )}

        {/* ── ERROR ── */}
        {state.step === "error" && (
          <motion.div key="error" {...fadeUp} className="space-y-4">
            <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-5">
              <p className="text-sm text-destructive/80">{state.message}</p>
            </div>
            <Button
              onClick={() => setState({ step: "idle" })}
              variant="outline"
              className="w-full h-10 text-sm cursor-pointer"
            >
              Try Again
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Small helpers ──────────────────────────────────────── */

function Dot() {
  return <div className="h-0.5 w-0.5 rounded-full bg-muted-foreground/30" />;
}

function Spinner() {
  return (
    <div className="relative h-8 w-8">
      <div className="absolute inset-0 rounded-full border-2 border-muted-foreground/10" />
      <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-foreground/40 animate-spin" />
    </div>
  );
}
