"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Check, Copy } from "lucide-react";

/* ─── Constants ─────────────────────────────────────────── */

const BTC_ADDRESS = "bc1qycng4mwrwpnxnpadjqanscsmz8pxshkrjmlz60qgtfqslq9swqkq8ksm33";
const BTC_URI = `bitcoin:${BTC_ADDRESS}`;

/* ─── Component ─────────────────────────────────────────── */

export function SupportView() {
  const [copied, setCopied] = useState(false);

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(BTC_ADDRESS);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const ta = document.createElement("textarea");
      ta.value = BTC_ADDRESS;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      {/* QR Card */}
      <div className="relative rounded-2xl border border-gold/[0.08] bg-background/40 p-6 space-y-5">
        {/* Subtle corner glow */}
        <div className="absolute inset-0 rounded-2xl pointer-events-none overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[300px] h-[200px] bg-gold/[0.03] blur-[80px]" />
        </div>

        <div className="relative space-y-5">
          {/* QR Code */}
          <div className="flex justify-center">
            <div className="p-4 rounded-xl bg-foreground/[0.97] shadow-lg shadow-black/20">
              <QRCodeSVG
                value={BTC_URI}
                size={180}
                bgColor="#f0ece4"
                fgColor="#0c0a0e"
                level="M"
                className="rounded-sm"
              />
            </div>
          </div>

          {/* Label */}
          <div className="text-center space-y-1">
            <p className="text-[11px] font-mono tracking-[0.2em] uppercase text-gold/40">
              Bitcoin &middot; On-chain
            </p>
          </div>

          {/* Address + copy */}
          <button
            onClick={copyAddress}
            className="w-full group relative flex items-center gap-2 px-4 py-3 rounded-xl border border-gold/[0.08] bg-background/60 hover:border-gold/15 hover:bg-gold/[0.02] transition-all cursor-pointer"
          >
            <span className="flex-1 text-[11px] font-mono text-muted-foreground/50 break-all text-left leading-relaxed">
              {BTC_ADDRESS}
            </span>
            <span className="shrink-0 text-gold/30 group-hover:text-gold/60 transition-colors">
              {copied ? (
                <Check className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </span>
          </button>

          {copied && (
            <p className="text-[11px] text-center text-emerald-400/70 font-medium">
              Address copied
            </p>
          )}
        </div>
      </div>

      {/* What your support does */}
      <div className="space-y-3 px-1">
        <div className="flex items-center gap-2">
          <div className="h-px flex-1 bg-gold/[0.06]" />
          <span className="text-[11px] font-mono tracking-[0.15em] uppercase text-gold/30">
            Where sats go
          </span>
          <div className="h-px flex-1 bg-gold/[0.06]" />
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: "🛠", label: "Development" },
            { icon: "⚡", label: "Hosting" },
            { icon: "🥠", label: "New fortunes" },
          ].map((item) => (
            <div
              key={item.label}
              className="text-center py-3.5 rounded-xl border border-gold/[0.05] bg-background/30"
            >
              <p className="text-lg mb-1.5">{item.icon}</p>
              <p className="text-[11px] text-muted-foreground/45 font-medium">
                {item.label}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Disclaimer */}
      <p className="text-[11px] text-center text-muted-foreground/30 leading-relaxed">
        FortuneSats is open source and community-funded.
        <br />
        No accounts. No ads. Just sats and wisdom.
      </p>
    </div>
  );
}
