"use client";

import { Suspense, useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
/* =========================================================================
 * MDK (archived — Strike-only as of 2026-04-17)
 * =========================================================================
 * import { useCheckoutSuccess } from "@moneydevkit/nextjs";
 */
import { motion, AnimatePresence } from "framer-motion";
import { Check, Copy, Gift } from "lucide-react";
import { ease } from "@/components/shared/animations";
import { OracleSpinner } from "@/components/shared/icons";
import { RARITY_CONFIG, type Rarity } from "@/lib/fortunes";
import Link from "next/link";

const SITE_URL = "https://fortunesats.com";

type FlowState =
  | { step: "verifying" }
  | { step: "creating"; attempt?: number }
  | { step: "ready"; token: string; rarity: Rarity; expiresAt: string }
  | { step: "error"; message: string; retriable?: boolean };

const MAX_RETRIES = 3;
const RETRY_DELAYS = [2000, 4000, 8000];

export default function GiftSuccessPage() {
  return (
    <Suspense
      fallback={
        <main className="flex-1 flex items-center justify-center px-6 py-12">
          <OracleSpinner />
        </main>
      }
    >
      <GiftSuccessInner />
    </Suspense>
  );
}

function GiftSuccessInner() {
  const searchParams = useSearchParams();
  /* =========================================================================
   * MDK (archived — Strike-only as of 2026-04-17)
   * =========================================================================
   * const { isCheckoutPaid, isCheckoutPaidLoading } = useCheckoutSuccess();
   */
  const [state, setState] = useState<FlowState>({ step: "verifying" });
  const [copied, setCopied] = useState(false);
  const createdRef = useRef(false);

  // The /api/gift/create route re-verifies against Strike directly, so the
  // client just triggers it once per checkoutId and retries on transient failures.
  useEffect(() => {
    if (createdRef.current) return;
    createdRef.current = true;

    const checkoutId = searchParams.get("checkout-id");
    if (!checkoutId) {
      setState({ step: "error", message: "Missing checkout reference." }); // eslint-disable-line react-hooks/set-state-in-effect
      return;
    }

    let cancelled = false;

    async function attemptCreate(attempt: number) {
      if (cancelled) return;
      setState({ step: "creating", attempt });

      try {
        const res = await fetch("/api/gift/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ checkoutId }),
        });

        if (res.ok) {
          const data = await res.json();
          if (cancelled) return;
          setState({
            step: "ready",
            token: data.token,
            rarity: data.rarity,
            expiresAt: data.expiresAt,
          });
          return;
        }

        const data = await res.json().catch(() => null);
        const retriable = res.status === 503 || res.status === 502 || res.status === 429
          || data?.error?.retriable === true;

        if (retriable && attempt < MAX_RETRIES) {
          const delay = RETRY_DELAYS[attempt - 1] ?? 8000;
          await new Promise((r) => setTimeout(r, delay));
          await attemptCreate(attempt + 1);
          return;
        }

        if (cancelled) return;
        setState({
          step: "error",
          message: data?.error?.message ?? "Failed to create gift",
          retriable,
        });
      } catch {
        if (attempt < MAX_RETRIES) {
          const delay = RETRY_DELAYS[attempt - 1] ?? 8000;
          await new Promise((r) => setTimeout(r, delay));
          await attemptCreate(attempt + 1);
          return;
        }
        if (cancelled) return;
        setState({
          step: "error",
          message: "Network error — please check your connection and refresh.",
          retriable: true,
        });
      }
    }

    attemptCreate(1);
    return () => { cancelled = true; };
  }, [searchParams]);

  /* =========================================================================
   * MDK (archived — Strike-only as of 2026-04-17)
   * =========================================================================
   * useEffect(() => {
   *   if (!isCheckoutPaidLoading && isCheckoutPaid === false) {
   *     setState({ step: "error", message: "Payment not confirmed. If you paid, please wait a moment and refresh." });
   *   }
   * }, [isCheckoutPaidLoading, isCheckoutPaid]);
   */

  const giftUrl = state.step === "ready" ? `${SITE_URL}/gift/${state.token}` : "";

  const copyLink = useCallback(() => {
    if (!giftUrl) return;
    navigator.clipboard.writeText(giftUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [giftUrl]);

  const rarityConfig = state.step === "ready" ? RARITY_CONFIG[state.rarity] : null;

  return (
    <main className="relative flex-1 flex flex-col items-center justify-center px-6 py-12 overflow-hidden">
      <div className="pointer-events-none absolute inset-0 z-[1] flex flex-col">
        <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full bg-lacquer/[0.04] blur-[120px]" />
        <div className="absolute bottom-[-10%] left-1/2 -translate-x-1/2 w-[500px] h-[300px] rounded-full bg-gold/[0.03] blur-[100px]" />
      </div>

      <div className="relative z-[2] w-full max-w-sm">
        <AnimatePresence mode="wait">
          {/* VERIFYING / CREATING */}
          {(state.step === "verifying" || state.step === "creating") && (
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
                  : "Preparing your gift\u2026"}
              </p>
            </motion.div>
          )}

          {/* GIFT READY */}
          {state.step === "ready" && (
            <motion.div
              key="ready"
              initial={{ opacity: 0, scale: 0.92, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.7, ease }}
              className="space-y-6"
            >
              {/* Gift card */}
              <div className="relative rounded-2xl overflow-hidden scanlines rarity-common">
                <div className="absolute inset-0 bg-gradient-to-b from-lacquer/[0.06] via-[#0c0a0e] to-[#0c0a0e]" />
                <div className="absolute inset-0 bg-gradient-to-br from-gold/[0.02] via-transparent to-lacquer/[0.02]" />
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 dragon-line" />

                <div className="relative p-8 space-y-6 ornamental-border">
                  {/* Success indicator */}
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    className="flex items-center justify-center"
                  >
                    <div className="h-12 w-12 rounded-full bg-cyan/10 border border-cyan/20 flex items-center justify-center">
                      <Gift className="h-6 w-6 text-cyan" />
                    </div>
                  </motion.div>

                  <div className="text-center space-y-2">
                    <h1 className="text-lg font-semibold text-foreground/90">
                      Gift Fortune Created
                    </h1>
                    <p className="text-sm text-gold/50">
                      A <span style={{ color: rarityConfig?.color }} className="font-medium">{rarityConfig?.label}</span> fortune awaits the recipient.
                    </p>
                  </div>

                  {/* Gift link */}
                  <div className="space-y-3">
                    <div className="rounded-lg bg-background/30 border border-gold/10 p-3">
                      <p className="text-xs text-gold/40 font-mono break-all leading-relaxed select-all">
                        {giftUrl}
                      </p>
                    </div>

                    <button
                      onClick={copyLink}
                      className="btn-lacquer w-full h-11 rounded-xl text-sm font-medium cursor-pointer active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                      {copied ? (
                        <>
                          <Check className="h-4 w-4 text-cyan" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4" />
                          Copy Gift Link
                        </>
                      )}
                    </button>
                  </div>

                  {/* Expiry note */}
                  <p className="text-[11px] text-gold/30 text-center">
                    Gift expires in 30 days. Can only be claimed once.
                  </p>

                  <div className="dragon-line w-full" />
                </div>
              </div>

              {/* Back home */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5, duration: 0.4 }}
              >
                <Link
                  href="/"
                  className="block w-full h-11 rounded-xl text-sm text-center leading-[2.75rem] text-muted-foreground/40 hover:text-gold/50 transition-colors"
                >
                  Back to Fortune Sats
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
              <div className="rounded-xl border border-lacquer/20 bg-lacquer/[0.04] p-5 space-y-2">
                <p className="text-sm text-lacquer/70">{state.message}</p>
                {state.retriable && (
                  <p className="text-xs text-gold/40">
                    Your payment was received. Please try refreshing.
                  </p>
                )}
              </div>
              {state.retriable && (
                <button
                  onClick={() => window.location.reload()}
                  className="btn-lacquer w-full h-10 rounded-xl text-sm cursor-pointer active:scale-[0.98]"
                >
                  Retry
                </button>
              )}
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
