"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
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
import { saveToCollection } from "@/lib/collection";
import { ease, fadeUp, scaleFade } from "@/components/shared/animations";
import { fireConfetti, firePackRarityConfetti } from "@/components/shared/confetti";
import { XIcon, GoldDot, OracleSpinner, CopyIcon, LinkIcon } from "@/components/shared/icons";

/* ─── Types ──────────────────────────────────────────────── */

interface StoredPack {
  orderId: string;
  /** Post-migration: secret lives in HttpOnly cookie. Populated only for pre-migration packs. */
  secret?: string;
}

type PackStep =
  | { step: "idle" }
  | { step: "loading" }
  | { step: "creating" }
  | {
      step: "awaiting-payment";
      orderId: string;
      secret: string;
      address: string;
      amountSats: number;
      expiresAt: string;
    }
  | {
      step: "verifying";
      orderId: string;
      secret: string;
      address: string;
      amountSats: number;
      expiresAt: string;
    }
  | {
      step: "celebration";
      orderId: string;
      secret: string;
      fortunesRemaining: number;
      fortunesTotal: number;
      txid: string;
      txStatus: "mempool" | "confirmed";
    }
  | {
      step: "paid";
      orderId: string;
      secret: string;
      fortunesRemaining: number;
      fortunesTotal: number;
      txid: string;
      txStatus: "mempool" | "confirmed";
    }
  | {
      step: "revealing";
      orderId: string;
      secret: string;
      fortunesRemaining: number;
      fortunesTotal: number;
    }
  | {
      step: "fortune";
      orderId: string;
      secret: string;
      fortune: string;
      rarity: Rarity;
      timestamp: string;
      fortunesRemaining: number;
      fortunesTotal: number;
    }
  | { step: "depleted" }
  | { step: "error"; message: string };

/* ─── Persistence ────────────────────────────────────────── */

const STORAGE_KEY = "fortunesats:pack";

function loadPack(): StoredPack | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Accept both old format {orderId, secret} and new format {orderId}
    if (parsed.orderId) return parsed;
    return null;
  } catch {
    return null;
  }
}

/**
 * Save pack reference to localStorage.
 * Post-migration: only stores orderId (secret lives in HttpOnly cookie).
 * Backward compat: old packs with secret in localStorage still work.
 */
function savePack(pack: StoredPack) {
  // Only persist orderId — secret is now in HttpOnly cookie
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ orderId: pack.orderId }));
}

function clearPack() {
  localStorage.removeItem(STORAGE_KEY);
}

/* ─── Component ──────────────────────────────────────────── */

export function FortunePack() {
  const [state, setState] = useState<PackStep>({ step: "idle" });
  const [copied, setCopied] = useState<string | null>(null);
  const [hasNativeShare, setHasNativeShare] = useState(false);
  const [txidInput, setTxidInput] = useState("");
  const [txidError, setTxidError] = useState<string | null>(null);
  const variantRef = useRef<ShareVariant>(pickVariant(true));
  const mountedRef = useRef(false);

  useEffect(() => {
    setHasNativeShare(canNativeShare());
  }, []);

  /* ── Restore pack from localStorage + HttpOnly cookie on mount ── */
  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;

    const stored = loadPack();
    if (!stored) return;

    setState({ step: "loading" });

    // Server reads secret from HttpOnly cookie; body orderId + optional secret for backward compat
    const bodyPayload: Record<string, string> = { orderId: stored.orderId };
    if (stored.secret) bodyPayload.secret = stored.secret; // backward compat: old packs with secret in localStorage

    fetch("/api/pack/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bodyPayload),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          clearPack();
          setState({ step: "idle" });
          return;
        }
        if (data.status === "mempool" || data.status === "confirmed") {
          if (data.fortunesRemaining <= 0) {
            clearPack();
            setState({ step: "depleted" });
          } else {
            setState({
              step: "paid",
              orderId: stored.orderId,
              secret: stored.secret ?? "",
              fortunesRemaining: data.fortunesRemaining,
              fortunesTotal: data.fortunesTotal,
              txid: data.txid,
              txStatus: data.status,
            });
          }
        } else if (data.status === "pending") {
          setState({
            step: "awaiting-payment",
            orderId: stored.orderId,
            secret: stored.secret ?? "",
            address: data.address,
            amountSats: data.amountSats,
            expiresAt: data.expiresAt,
          });
        } else {
          clearPack();
          setState({ step: "idle" });
        }
      })
      .catch(() => {
        clearPack();
        setState({ step: "idle" });
      });
  }, []);

  /* ── Fire confetti when celebration state begins ── */
  useEffect(() => {
    if (state.step !== "celebration") return;
    fireConfetti();
  }, [state.step]);

  /* ── Confetti + collection on pack fortune reveal ── */
  useEffect(() => {
    if (state.step !== "fortune") return;
    if (state.rarity === "legendary" || state.rarity === "epic") {
      firePackRarityConfetti(state.rarity);
    }
    saveToCollection(state.fortune, state.rarity);
  }, [state.step]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── "Revealing" → fortune transition ── */
  useEffect(() => {
    if (state.step !== "revealing") return;
    const { orderId, secret, fortunesRemaining, fortunesTotal } = state;
    const timer = setTimeout(() => {
      // Server reads secret from HttpOnly cookie; body has orderId + optional secret for backward compat
      const bodyPayload: Record<string, string> = { orderId };
      if (secret) bodyPayload.secret = secret;

      fetch("/api/pack/fortune", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.error) {
            if (data.error.code === "depleted") {
              clearPack();
              setState({ step: "depleted" });
            } else {
              setState({ step: "error", message: data.error.message });
            }
            return;
          }
          variantRef.current = pickVariant(true);
          setState({
            step: "fortune",
            orderId,
            secret,
            fortune: data.fortune,
            rarity: data.rarity ?? "common",
            timestamp: data.timestamp,
            fortunesRemaining: data.fortunesRemaining,
            fortunesTotal: data.fortunesTotal ?? fortunesTotal,
          });
        })
        .catch(() => {
          setState({
            step: "paid",
            orderId,
            secret,
            fortunesRemaining,
            fortunesTotal,
            txid: "",
            txStatus: "mempool",
          });
        });
    }, 600);
    return () => clearTimeout(timer);
  }, [state]);

  /* ── Create order ── */
  const buyPack = useCallback(async () => {
    setState({ step: "creating" });
    try {
      const res = await fetch("/api/pack", { method: "POST" });
      if (!res.ok) throw new Error("Failed to create order");
      const data = await res.json();
      // Server sets HttpOnly cookie with secret; we only store orderId
      savePack({ orderId: data.orderId });
      setState({
        step: "awaiting-payment",
        orderId: data.orderId,
        secret: "", // secret now lives in HttpOnly cookie
        address: data.address,
        amountSats: data.amountSats,
        expiresAt: data.expiresAt,
      });
    } catch (e) {
      setState({
        step: "error",
        message: e instanceof Error ? e.message : "Network error",
      });
    }
  }, []);

  /* ── Submit txid for verification ── */
  const submitTxid = useCallback(async () => {
    if (state.step !== "awaiting-payment") return;
    const trimmed = txidInput.trim();
    if (!/^[a-fA-F0-9]{64}$/.test(trimmed)) {
      setTxidError("Please paste a valid 64-character transaction ID.");
      return;
    }
    setTxidError(null);

    const { orderId, secret, address, amountSats, expiresAt } = state;
    setState({
      step: "verifying",
      orderId,
      secret,
      address,
      amountSats,
      expiresAt,
    });

    try {
      // Server reads secret from HttpOnly cookie; body has orderId + optional secret for backward compat
      const bodyPayload: Record<string, string> = { orderId, txid: trimmed };
      if (secret) bodyPayload.secret = secret;

      const res = await fetch("/api/pack/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload),
      });
      const data = await res.json();

      if (data.error) {
        setTxidError(data.error.message);
        setState({
          step: "awaiting-payment",
          orderId,
          secret,
          address,
          amountSats,
          expiresAt,
        });
        return;
      }

      if (data.status === "mempool" || data.status === "confirmed") {
        setState({
          step: "celebration",
          orderId,
          secret,
          fortunesRemaining: data.fortunesRemaining,
          fortunesTotal: data.fortunesTotal,
          txid: data.txid,
          txStatus: data.status,
        });
      } else {
        setTxidError("Transaction not yet detected. Try again in a moment.");
        setState({
          step: "awaiting-payment",
          orderId,
          secret,
          address,
          amountSats,
          expiresAt,
        });
      }
    } catch {
      setTxidError("Network error. Please try again.");
      setState({
        step: "awaiting-payment",
        orderId,
        secret,
        address,
        amountSats,
        expiresAt,
      });
    }
  }, [state, txidInput]);

  /* ── Transition from celebration → paid ── */
  const startCracking = useCallback(() => {
    if (state.step !== "celebration") return;
    const { orderId, secret, fortunesRemaining, fortunesTotal, txid, txStatus } =
      state;
    setState({
      step: "paid",
      orderId,
      secret,
      fortunesRemaining,
      fortunesTotal,
      txid,
      txStatus,
    });
  }, [state]);

  /* ── Reveal fortune ── */
  const revealFortune = useCallback(() => {
    if (state.step !== "paid" && state.step !== "fortune") return;
    const { orderId, secret, fortunesRemaining, fortunesTotal } = state;
    setState({
      step: "revealing",
      orderId,
      secret,
      fortunesRemaining,
      fortunesTotal,
    });
  }, [state]);

  /* ── Clipboard ── */
  const copyToClipboard = useCallback((text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  }, []);

  /* ── Share handlers ── */
  const shareOnX = useCallback((fortune: string, rarity: Rarity) => {
    const v = variantRef.current;
    trackShare("x_share", v.id);
    window.open(buildXShareUrl(fortune, v, rarity), "_blank", "noopener,noreferrer");
  }, []);

  const copyShareTextFn = useCallback(
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

  return (
    <div className="w-full">
      <AnimatePresence mode="wait">
        {/* ────────────────── IDLE ────────────────── */}
        {state.step === "idle" && (
          <motion.div key="idle" {...fadeUp} className="space-y-8">
            <div className="jade-surface rounded-2xl p-6 space-y-4 ornamental-border">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gold/50 font-mono tracking-wide">
                  Fortune Pack
                </span>
                <span className="font-mono text-xs text-ember/60">
                  10,000 sats
                </span>
              </div>
              <div className="text-center space-y-2 py-3">
                <div className="text-4xl drop-shadow-[0_0_20px_rgba(212,162,87,0.15)]">
                  🥠 &times;100
                </div>
                <p className="text-sm text-foreground/70 leading-relaxed">
                  One hundred fortunes, unlocked instantly.
                  <br />
                  <span className="text-gold/40 text-xs">
                    Paid on-chain. Accepted on mempool detection.
                  </span>
                </p>
              </div>
              <div className="dragon-line w-full" />
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <div className="font-mono text-lg text-gold/70">100</div>
                  <div className="text-[10px] text-muted-foreground/40 uppercase tracking-wider">
                    Fortunes
                  </div>
                </div>
                <div>
                  <div className="font-mono text-lg text-gold/70">100</div>
                  <div className="text-[10px] text-muted-foreground/40 uppercase tracking-wider">
                    sats/each
                  </div>
                </div>
                <div>
                  <div className="font-mono text-lg text-cyan/70">₿</div>
                  <div className="text-[10px] text-muted-foreground/40 uppercase tracking-wider">
                    On-chain
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={buyPack}
              className="btn-lacquer w-full h-14 rounded-xl text-sm font-semibold tracking-wide cursor-pointer transition-all active:scale-[0.98]"
            >
              Buy Fortune Pack
            </button>

            <div className="flex items-center justify-center gap-4 text-[10px] tracking-[0.15em] uppercase font-mono">
              <span className="text-lacquer/50">Order</span>
              <GoldDot />
              <span className="text-gold/30">Pay</span>
              <GoldDot />
              <span className="text-gold/30">Paste txid</span>
              <GoldDot />
              <span className="text-gold/30">Fortunes</span>
            </div>
          </motion.div>
        )}

        {/* ────────────────── LOADING (restoring from localStorage) ── */}
        {state.step === "loading" && (
          <motion.div key="loading" {...fadeUp} className="space-y-5">
            <div className="flex flex-col items-center gap-5 py-10">
              <OracleSpinner />
              <p className="text-sm text-gold/50 tracking-wide">
                Restoring your pack&hellip;
              </p>
            </div>
          </motion.div>
        )}

        {/* ────────────────── CREATING ────────────────── */}
        {state.step === "creating" && (
          <motion.div key="creating" {...fadeUp} className="space-y-5">
            <div className="flex flex-col items-center gap-5 py-10">
              <OracleSpinner />
              <p className="text-sm text-gold/50 tracking-wide">
                Creating your order&hellip;
              </p>
            </div>
          </motion.div>
        )}

        {/* ────────────────── AWAITING PAYMENT ────────────────── */}
        {state.step === "awaiting-payment" && (
          <motion.div key="awaiting" {...scaleFade} className="space-y-5">
            <div className="lacquer-surface rounded-2xl p-6 space-y-5 ornamental-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-lacquer animate-glow-pulse" />
                  <span className="text-xs text-gold/50 font-mono tracking-wide">
                    Send payment
                  </span>
                </div>
                <span className="font-mono text-xs text-ember/60">
                  {state.amountSats.toLocaleString()} sats
                </span>
              </div>

              <div className="flex justify-center">
                <div className="rounded-xl bg-[#f0ece4] p-4 glow-gold">
                  <QRCodeSVG
                    value={`bitcoin:${state.address}?amount=${(state.amountSats / 1e8).toFixed(8)}`}
                    size={200}
                    level="M"
                    bgColor="transparent"
                    fgColor="#0c0a0e"
                  />
                </div>
              </div>

              <button
                onClick={() => copyToClipboard(state.address, "address")}
                className="w-full group cursor-pointer"
              >
                <div className="font-mono text-[9px] leading-relaxed text-gold/30 group-hover:text-gold/50 transition-colors text-center break-all">
                  {state.address}
                </div>
                <div className="text-[10px] text-lacquer/40 mt-1 group-hover:text-lacquer/60 transition-colors text-center">
                  {copied === "address" ? "Copied!" : "Tap to copy address"}
                </div>
              </button>

              <div className="flex items-center justify-center gap-3 text-[10px] font-mono text-gold/20">
                <span>Send exactly</span>
                <span className="text-ember/50">
                  {(state.amountSats / 1e8).toFixed(8)} BTC
                </span>
                <span>({state.amountSats.toLocaleString()} sats)</span>
              </div>
            </div>

            {/* Payment instructions */}
            <div className="rounded-xl border border-gold/8 bg-gold/[0.02] p-4 space-y-2.5">
              <div className="text-[11px] font-medium text-gold/50">Payment Instructions</div>
              <ol className="space-y-1.5 text-[10px] text-gold/35 leading-relaxed list-decimal list-inside">
                <li>Send <span className="text-ember/60 font-mono">{state.amountSats.toLocaleString()} sats</span> ({(state.amountSats / 1e8).toFixed(8)} BTC) to the address above</li>
                <li>Payment is detected automatically when it appears in the mempool</li>
                <li>After sending, paste your <span className="text-gold/50">transaction ID</span> below to verify</li>
              </ol>
              <p className="text-[9px] text-gold/20 leading-relaxed">
                Detection usually takes 10&ndash;60 seconds after broadcast.
                If your wallet doesn&apos;t show a txid, check{" "}
                <a
                  href={`https://mempool.space/address/${state.address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan/40 hover:text-cyan/60 underline underline-offset-2 transition-colors"
                >
                  mempool.space
                </a>
                {" "}for your transaction.
              </p>
            </div>

            {/* Copy address button */}
            <button
              onClick={() => copyToClipboard(state.address, "address")}
              className="btn-lacquer w-full h-11 rounded-xl text-sm font-medium cursor-pointer active:scale-[0.98]"
            >
              {copied === "address" ? "Copied!" : "Copy BTC Address"}
            </button>

            {/* ── Paste txid section ── */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gold/10 to-transparent" />
                <span className="text-[9px] tracking-[0.2em] uppercase text-gold/25 font-mono">
                  After paying
                </span>
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gold/10 to-transparent" />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="txid-input"
                  className="block text-[11px] text-gold/40"
                >
                  Paste your transaction ID to verify payment
                </label>
                <input
                  id="txid-input"
                  type="text"
                  value={txidInput}
                  onChange={(e) => {
                    setTxidInput(e.target.value);
                    setTxidError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitTxid();
                  }}
                  placeholder="e.g. a1b2c3d4e5f6..."
                  spellCheck={false}
                  autoComplete="off"
                  className="w-full h-10 px-3 rounded-lg bg-[#0c0a0e] border border-gold/10 focus:border-gold/30 focus:outline-none font-mono text-[11px] text-foreground/70 placeholder:text-gold/15 transition-colors"
                />
                {txidError && (
                  <div className="space-y-1">
                    <p className="text-[11px] text-lacquer/70">{txidError}</p>
                    <p className="text-[10px] text-gold/20">
                      Check{" "}
                      <a
                        href={`https://mempool.space/address/${state.step === "awaiting-payment" ? state.address : ""}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-cyan/40 hover:text-cyan/60 underline underline-offset-2 transition-colors"
                      >
                        mempool.space
                      </a>
                      {" "}to find your transaction ID.
                    </p>
                  </div>
                )}
              </div>

              <button
                onClick={submitTxid}
                disabled={!txidInput.trim()}
                className="btn-lacquer w-full h-11 rounded-xl text-sm font-medium cursor-pointer active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Verify Payment
              </button>
            </div>

            {/* Cancel */}
            <div className="text-center">
              <button
                onClick={() => {
                  clearPack();
                  setTxidInput("");
                  setTxidError(null);
                  setState({ step: "idle" });
                }}
                className="text-[11px] text-muted-foreground/30 hover:text-lacquer/50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        )}

        {/* ────────────────── VERIFYING ────────────────── */}
        {state.step === "verifying" && (
          <motion.div key="verifying" {...fadeUp} className="space-y-5">
            <div className="flex flex-col items-center gap-5 py-10">
              <OracleSpinner />
              <p className="text-sm text-gold/50 tracking-wide">
                Verifying transaction&hellip;
              </p>
              <p className="text-[10px] text-gold/20 font-mono">
                Checking mempool.space
              </p>
            </div>
          </motion.div>
        )}

        {/* ────────────────── CELEBRATION ────────────────── */}
        {state.step === "celebration" && (
          <motion.div
            key="celebration"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 0.6, ease }}
            className="space-y-6"
          >
            <div className="relative rounded-2xl overflow-hidden fortune-reveal-glow">
              <div className="absolute inset-0 bg-gradient-to-b from-cyan/[0.08] via-[#0c0a0e] to-[#0c0a0e]" />
              <div className="absolute inset-0 bg-gradient-to-br from-gold/[0.04] via-transparent to-cyan/[0.02]" />
              <div className="absolute inset-0 rounded-2xl border border-cyan/15" />

              <div className="relative p-8 space-y-6 text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{
                    type: "spring",
                    stiffness: 300,
                    damping: 20,
                    delay: 0.2,
                  }}
                  className="mx-auto h-14 w-14 rounded-full bg-cyan/10 border border-cyan/20 flex items-center justify-center"
                >
                  <svg
                    className="h-7 w-7 text-cyan"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4, duration: 0.5, ease }}
                  className="space-y-3"
                >
                  <h3 className="text-xl font-semibold text-foreground/90">
                    Payment Verified
                  </h3>
                  <div className="dragon-line w-24 mx-auto" />
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6, duration: 0.5, ease }}
                  className="space-y-4"
                >
                  <p className="text-sm text-gold/60 leading-relaxed max-w-[260px] mx-auto">
                    We appreciate you investing in wisdom.
                    <br />
                    <span className="text-foreground/70 font-medium">
                      Enjoy your 100 fortunes.
                    </span>
                  </p>

                  <div className="flex items-center justify-center gap-2 text-[10px] font-mono text-cyan/40">
                    <span>txid:</span>
                    <span className="text-cyan/50">
                      {state.txid?.slice(0, 12)}&hellip;
                    </span>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.8, duration: 0.4 }}
                  className="pt-2"
                >
                  <p className="text-[10px] text-cyan/25 italic">
                    {state.txStatus === "mempool"
                      ? "Transaction seen in mempool \u2014 your fortunes are fully unlocked"
                      : "Transaction confirmed on-chain"}
                  </p>
                </motion.div>
              </div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.0, duration: 0.4, ease }}
            >
              <button
                onClick={startCracking}
                className="btn-lacquer w-full h-14 rounded-xl text-sm font-semibold tracking-wide cursor-pointer transition-all active:scale-[0.98]"
              >
                Start Cracking Fortunes
              </button>
            </motion.div>
          </motion.div>
        )}

        {/* ────────────────── PAID — FORTUNE DISPENSER ────────────────── */}
        {state.step === "paid" && (
          <motion.div key="paid" {...scaleFade} className="space-y-6">
            <div className="jade-surface rounded-2xl p-6 space-y-4 ornamental-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-cyan shadow-[0_0_6px_rgba(0,200,212,0.4)]" />
                  <span className="text-xs text-cyan/60 font-mono tracking-wide">
                    {state.txStatus === "confirmed"
                      ? "Confirmed on-chain"
                      : "Detected in mempool"}
                  </span>
                </div>
                <span className="font-mono text-xs text-gold/40">
                  {state.txid?.slice(0, 8)}&hellip;
                </span>
              </div>

              <div className="text-center py-4">
                <motion.div
                  className="text-5xl mb-3"
                  animate={{ rotate: [0, -5, 5, -3, 0] }}
                  transition={{ duration: 0.6, ease: "easeInOut" }}
                  key={state.fortunesRemaining}
                >
                  🥠
                </motion.div>
                <motion.div
                  className="font-mono text-4xl text-gold/80"
                  key={`count-${state.fortunesRemaining}`}
                  initial={{ scale: 1.2, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  {state.fortunesRemaining}
                </motion.div>
                <div className="text-[11px] text-muted-foreground/40 mt-1">
                  fortunes remaining
                </div>

                <div className="mt-4 mx-auto w-56 h-1.5 rounded-full bg-gold/5 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-lacquer/60 via-gold/40 to-gold/60"
                    animate={{
                      width: `${(state.fortunesRemaining / state.fortunesTotal) * 100}%`,
                    }}
                    transition={{ duration: 0.5, ease }}
                  />
                </div>
                <div className="mt-2 text-[10px] font-mono text-gold/20">
                  {state.fortunesTotal - state.fortunesRemaining} claimed
                  &middot; {state.fortunesRemaining} to go
                </div>
              </div>

              {state.txStatus === "mempool" && (
                <p className="text-[10px] text-center text-cyan/30 leading-relaxed">
                  Transaction in mempool &mdash; awaiting block confirmation.
                  <br />
                  Your fortunes are fully unlocked.
                </p>
              )}
            </div>

            <button
              onClick={revealFortune}
              className="btn-lacquer w-full h-14 rounded-xl text-sm font-semibold tracking-wide cursor-pointer transition-all active:scale-[0.98]"
            >
              Crack Open a Fortune
            </button>
          </motion.div>
        )}

        {/* ────────────────── REVEALING ────────────────── */}
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
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="text-4xl"
            >
              🥠
            </motion.div>
            <p className="text-xs text-gold/40">
              Cracking open your fortune&hellip;
            </p>
            <motion.div
              animate={{ scaleX: [0.3, 1, 0.3] }}
              transition={{
                duration: 0.8,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="w-20 h-px bg-gradient-to-r from-transparent via-gold/30 to-transparent"
            />
          </motion.div>
        )}

        {/* ────────────────── FORTUNE REVEALED ────────────────── */}
        {state.step === "fortune" && (
          <motion.div
            key={`fortune-${state.fortunesRemaining}`}
            initial={{ opacity: 0, scale: 0.92, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.7, ease }}
            className="space-y-5"
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

              <div className="relative p-7 space-y-5 ornamental-border">
                {/* Rarity badge */}
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1, duration: 0.3, ease }}
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
                  transition={{ delay: 0.15, duration: 0.4, ease }}
                  className="text-xl drop-shadow-[0_0_12px_rgba(212,162,87,0.3)]"
                >
                  🥠
                </motion.div>

                <motion.blockquote
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3, duration: 0.5, ease }}
                  className={`text-[17px] leading-relaxed tracking-tight font-light ${
                    state.rarity === "legendary"
                      ? "text-shimmer-gold"
                      : "text-foreground/90"
                  }`}
                >
                  {state.rarity !== "legendary" && <span className="text-gold/60">&ldquo;</span>}
                  {state.rarity === "legendary" ? `\u201C${state.fortune}\u201D` : state.fortune}
                  {state.rarity !== "legendary" && <span className="text-gold/60">&rdquo;</span>}
                </motion.blockquote>

                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5, duration: 0.3 }}
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
                  <span className="font-mono text-[10px] text-gold/30">
                    #{state.fortunesTotal - state.fortunesRemaining}
                  </span>
                  <span className="font-mono text-[10px] text-gold/15">
                    of {state.fortunesTotal}
                  </span>
                </motion.div>
              </div>
            </div>

            {/* Remaining mini-bar */}
            <div className="flex items-center gap-3 px-1">
              <div className="flex-1 h-1 rounded-full bg-gold/5 overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-lacquer/50 to-gold/30"
                  initial={{ width: "100%" }}
                  animate={{
                    width: `${(state.fortunesRemaining / state.fortunesTotal) * 100}%`,
                  }}
                  transition={{ duration: 0.5, ease }}
                />
              </div>
              <span className="font-mono text-[10px] text-gold/25 whitespace-nowrap">
                {state.fortunesRemaining} left
              </span>
            </div>

            {/* Share module */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.4, ease }}
              className="space-y-2.5"
            >
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gold/10 to-transparent" />
                <span className="text-[9px] tracking-[0.2em] uppercase text-gold/25 font-mono">
                  Share
                </span>
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gold/10 to-transparent" />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => shareOnX(state.fortune, state.rarity)}
                  className="btn-lacquer flex-1 h-9 rounded-lg text-xs font-medium cursor-pointer active:scale-[0.98] flex items-center justify-center gap-1.5"
                >
                  <XIcon className="h-3 w-3" />
                  Share on X
                </button>
                <button
                  className="btn-jade h-9 w-9 rounded-lg cursor-pointer active:scale-[0.98] flex items-center justify-center"
                  onClick={() => copyShareTextFn(state.fortune, state.rarity)}
                  title="Copy fortune text"
                >
                  <CopyIcon copied={copied === "text"} />
                </button>
                <button
                  className="btn-jade h-9 w-9 rounded-lg cursor-pointer active:scale-[0.98] flex items-center justify-center"
                  onClick={() => copyLink(state.fortune, state.rarity)}
                  title="Copy link"
                >
                  <LinkIcon copied={copied === "link"} />
                </button>
                {hasNativeShare && (
                  <button
                    className="btn-jade h-9 w-9 rounded-lg cursor-pointer active:scale-[0.98] flex items-center justify-center text-gold/40"
                    onClick={() => handleNativeShare(state.fortune, state.rarity)}
                    title="More sharing options"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-3.5 w-3.5"
                    >
                      <circle cx="18" cy="5" r="3" />
                      <circle cx="6" cy="12" r="3" />
                      <circle cx="18" cy="19" r="3" />
                      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                    </svg>
                  </button>
                )}
              </div>
            </motion.div>

            {/* Next fortune CTA */}
            {state.fortunesRemaining > 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7, duration: 0.3 }}
              >
                <button
                  onClick={revealFortune}
                  className="btn-lacquer w-full h-12 rounded-xl text-sm font-semibold cursor-pointer transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  <span>Next Fortune</span>
                  <span className="text-xs opacity-60">
                    ({state.fortunesRemaining} left)
                  </span>
                </button>
              </motion.div>
            ) : (
              <button
                onClick={() => {
                  clearPack();
                  setState({ step: "depleted" });
                }}
                className="w-full h-11 rounded-xl text-sm text-muted-foreground/30 hover:text-gold/40 transition-colors cursor-pointer"
              >
                Pack Complete
              </button>
            )}
          </motion.div>
        )}

        {/* ────────────────── DEPLETED ────────────────── */}
        {state.step === "depleted" && (
          <motion.div key="depleted" {...fadeUp} className="space-y-6">
            <div className="jade-surface rounded-2xl p-8 text-center space-y-4 ornamental-border">
              <div className="text-4xl">✨</div>
              <h3 className="text-lg font-medium text-foreground/80">
                All 100 fortunes revealed
              </h3>
              <p className="text-sm text-muted-foreground/50 leading-relaxed">
                You&apos;ve claimed every fortune in this pack.
                <br />
                May the wisdom serve you well.
              </p>
              <div className="dragon-line w-16 mx-auto" />
              <p className="text-[10px] text-gold/25 italic">
                Thank you for investing in wisdom.
              </p>
            </div>
            <button
              onClick={() => setState({ step: "idle" })}
              className="btn-lacquer w-full h-12 rounded-xl text-sm font-semibold cursor-pointer active:scale-[0.98]"
            >
              Buy Another Pack
            </button>
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

