"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { Check, Copy } from "lucide-react";
import { OracleSpinner } from "@/components/shared/icons";

/* ─── Types ──────────────────────────────────────────────── */

interface CheckoutPresentation {
  invoiceId: string;
  state: "UNPAID" | "PENDING" | "PAID" | "CANCELLED";
  paid: boolean;
  quoteExpiresAt: number | null;
  quoteExpired: boolean;
  lnInvoice: string | null;
  amountSats: number;
  description: string;
}

const POLL_MS = 3000;
const INITIAL_DELAY_MS = 5000;

/* ─── Component ──────────────────────────────────────────── */

export function StrikeCheckoutClient({
  initial,
  successPath = "/fortune/success",
}: {
  initial: CheckoutPresentation;
  successPath?: string;
}) {
  const [presentation, setPresentation] = useState<CheckoutPresentation>(initial);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inflightRef = useRef(false);
  const refreshingRef = useRef(false);
  const redirectedRef = useRef(false);

  /* ── Redirect once paid ── */
  useEffect(() => {
    if (!presentation.paid || redirectedRef.current) return;
    redirectedRef.current = true;
    const q = successPath.includes("?") ? "&" : "?";
    window.location.href = `${successPath}${q}checkout-id=${encodeURIComponent(presentation.invoiceId)}`;
  }, [presentation.paid, presentation.invoiceId, successPath]);

  /* ── Refresh quote when expired (NX-locked server-side) ── */
  const refreshQuote = useCallback(async (id: string) => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    try {
      const res = await fetch("/api/checkout/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        const next = (await res.json()) as CheckoutPresentation;
        setPresentation(next);
      }
    } catch {
      // Silent — next poll tick will try again.
    } finally {
      refreshingRef.current = false;
    }
  }, []);

  /* ── Poll ── */
  useEffect(() => {
    if (presentation.paid || presentation.state === "CANCELLED") return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function tick() {
      if (cancelled) return;
      if (document.hidden) {
        timer = setTimeout(tick, POLL_MS);
        return;
      }
      if (inflightRef.current) {
        timer = setTimeout(tick, POLL_MS);
        return;
      }
      inflightRef.current = true;
      try {
        const res = await fetch(
          `/api/checkout-status?id=${encodeURIComponent(presentation.invoiceId)}`,
          { cache: "no-store" },
        );
        if (!res.ok) throw new Error(`status ${res.status}`);
        const next = (await res.json()) as CheckoutPresentation;
        if (cancelled) return;
        setPresentation(next);
        setError(null);

        if (!next.paid && next.state === "UNPAID" && next.quoteExpired) {
          await refreshQuote(next.invoiceId);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Network error");
        }
      } finally {
        inflightRef.current = false;
        if (!cancelled) timer = setTimeout(tick, POLL_MS);
      }
    }

    const initial = setTimeout(tick, INITIAL_DELAY_MS);

    const onVis = () => {
      if (!document.hidden && !cancelled && !inflightRef.current) {
        if (timer) clearTimeout(timer);
        timer = setTimeout(tick, 0);
      }
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelled = true;
      clearTimeout(initial);
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [presentation.invoiceId, presentation.paid, presentation.state, refreshQuote]);

  const copyInvoice = useCallback(() => {
    if (!presentation.lnInvoice) return;
    navigator.clipboard.writeText(presentation.lnInvoice);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [presentation.lnInvoice]);

  /* ── Render ── */

  if (presentation.state === "CANCELLED") {
    return (
      <div className="rounded-xl border border-lacquer/20 bg-lacquer/[0.04] p-5 space-y-2 text-center">
        <p className="text-sm text-lacquer/70">This invoice was cancelled.</p>
        <Link
          href="/"
          className="inline-block mt-2 text-xs text-gold/60 hover:text-gold/80 transition-colors"
        >
          Start over →
        </Link>
      </div>
    );
  }

  if (presentation.paid) {
    return (
      <div className="flex flex-col items-center gap-4 py-10">
        <OracleSpinner />
        <p className="text-sm text-cyan/70">Payment received — revealing your fortune…</p>
      </div>
    );
  }

  if (!presentation.lnInvoice) {
    return (
      <div className="flex flex-col items-center gap-4 py-10">
        <OracleSpinner />
        <p className="text-sm text-gold/50">Preparing invoice…</p>
      </div>
    );
  }

  const ln = presentation.lnInvoice;
  const walletUri = `lightning:${ln}`;

  return (
    <div className="space-y-5">
      {/* QR */}
      <div className="flex justify-center">
        <div className="rounded-xl bg-white p-4 shadow-[0_0_40px_rgba(212,162,87,0.08)]">
          <QRCodeSVG
            value={walletUri}
            size={232}
            level="M"
            marginSize={0}
            aria-label="Lightning invoice QR code"
          />
        </div>
      </div>

      {/* Amount */}
      <p className="text-center text-xs font-mono text-gold/50">
        {presentation.amountSats.toLocaleString()} sats
      </p>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={copyInvoice}
          className="btn-jade flex-1 h-10 rounded-lg text-xs font-medium cursor-pointer active:scale-[0.98] flex items-center justify-center gap-1.5"
        >
          <span className="relative h-3 w-3">
            <span
              className={`absolute inset-0 transition-all duration-200 ${
                copied ? "scale-0 opacity-0" : "scale-100 opacity-100"
              }`}
            >
              <Copy className="h-3 w-3" />
            </span>
            <span
              className={`absolute inset-0 transition-all duration-200 ${
                copied ? "scale-100 opacity-100" : "scale-0 opacity-0"
              }`}
            >
              <Check className="h-3 w-3 text-cyan" />
            </span>
          </span>
          {copied ? "Copied!" : "Copy invoice"}
        </button>
        <a
          href={walletUri}
          className="btn-lacquer flex-1 h-10 rounded-lg text-xs font-medium cursor-pointer active:scale-[0.98] flex items-center justify-center"
        >
          Open wallet
        </a>
      </div>

      {/* Status strip */}
      <div className="flex items-center justify-center gap-2 text-[11px] font-mono text-gold/35">
        <OracleSpinner />
        <span>Waiting for payment…</span>
      </div>

      {presentation.quoteExpired && (
        <p className="text-center text-[11px] text-gold/40">
          Refreshing expired invoice…
        </p>
      )}

      {error && (
        <p className="text-center text-[11px] text-lacquer/60">
          Reconnecting…
        </p>
      )}
    </div>
  );
}
