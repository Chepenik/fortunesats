"use client";

import { useState, useCallback } from "react";
import { useCheckout } from "@moneydevkit/nextjs";
import { config } from "@/lib/config";
import { OracleSpinner } from "@/components/shared/icons";

export function GiftButton() {
  const { createCheckout, isLoading } = useCheckout();
  const [error, setError] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);

  const sendGift = useCallback(async () => {
    setError(null);
    setRequesting(true);
    try {
      const result = await createCheckout({
        type: "AMOUNT",
        amount: config.pricing.fortuneGift,
        currency: "SAT",
        title: "Fortune Gift",
        description: "Send a fortune gift — Fortune Sats",
        successUrl: "/gift/success",
      });

      if (result.data) {
        window.location.href = result.data.checkoutUrl;
        return;
      }

      setError(result.error?.message ?? "Could not create checkout.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setRequesting(false);
    }
  }, [createCheckout]);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gold/8 to-transparent" />
        <span className="text-[11px] tracking-[0.15em] uppercase text-gold/30 font-mono">
          Gift a fortune
        </span>
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gold/8 to-transparent" />
      </div>

      <button
        onClick={sendGift}
        disabled={isLoading || requesting}
        className="btn-jade w-full h-10 rounded-xl text-sm font-medium cursor-pointer transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {requesting ? (
          <OracleSpinner />
        ) : (
          <>
            <span>🎁</span>
            Send a Fortune Gift
            <span className="text-gold/40 font-mono text-xs ml-1">
              {config.pricing.fortuneGift} sats
            </span>
          </>
        )}
      </button>

      {error && (
        <p className="text-xs text-lacquer/60 text-center">{error}</p>
      )}

      <p className="text-[11px] text-gold/25 text-center leading-relaxed">
        Pay {config.pricing.fortuneGift} sats, get a unique claim link to share.
      </p>
    </div>
  );
}
