import { FortunePack } from "@/components/fortune-pack";
import { getFlags } from "@/lib/flags";
import Link from "next/link";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Fortune Pack — 100 Bitcoin Fortunes for 10,000 Sats",
  description:
    "Buy a Fortune Pack: 100 wisdom fortunes for 10,000 sats. Pay on-chain Bitcoin, accepted instantly on mempool detection.",
  alternates: { canonical: "https://fortunesats.com/pack" },
};

export default function PackPage() {
  const { fortunePackEnabled } = getFlags();

  return (
    <main className="relative flex-1 flex flex-col items-center justify-center px-6 py-12 overflow-hidden">
      {/* Ambient radial glows */}
      <div className="pointer-events-none absolute inset-0 flex flex-col">
        <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full bg-lacquer/[0.04] blur-[120px]" />
        <div className="absolute bottom-[-10%] left-1/2 -translate-x-1/2 w-[500px] h-[300px] rounded-full bg-gold/[0.03] blur-[100px]" />
        <div className="absolute top-[20%] right-[-10%] w-[200px] h-[200px] rounded-full bg-cyan/[0.02] blur-[80px]" />
      </div>

      <div className="relative w-full max-w-sm space-y-10">
        {/* Hero */}
        <header className="text-center space-y-5">
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="h-px w-8 bg-gradient-to-r from-transparent to-gold/20" />
            <div className="h-1 w-1 rounded-full bg-lacquer/40" />
            <div className="h-px w-8 bg-gradient-to-l from-transparent to-gold/20" />
          </div>

          <div className="text-5xl drop-shadow-[0_0_20px_rgba(212,162,87,0.15)]">
            🥠
          </div>

          <div className="space-y-3">
            <h1 className="text-3xl font-bold tracking-tight neon-text text-foreground">
              Fortune Pack
            </h1>
            <p className="text-[15px] leading-relaxed">
              <span className="text-gold/80">10,000 sats.</span>{" "}
              <span className="text-foreground/60">100 fortunes.</span>
              <br />
              <span className="text-muted-foreground/50 text-[13px]">
                On-chain Bitcoin. Instant mempool acceptance.
              </span>
            </p>
          </div>
        </header>

        {/* Machine */}
        {fortunePackEnabled ? (
          <FortunePack />
        ) : (
          <div className="text-center py-8 space-y-3">
            <p className="text-sm text-muted-foreground/60">New pack purchases are temporarily unavailable.</p>
            <p className="text-xs text-gold/30">Existing packs can still be claimed.</p>
            <Link href="/" className="inline-block text-xs text-gold/50 hover:text-gold/70 transition-colors mt-2">
              &larr; Back to Fortune Sats
            </Link>
          </div>
        )}

        {/* Footer */}
        <footer className="space-y-4 text-center">
          <div className="dragon-line w-16 mx-auto" />
          <p className="text-[11px] tracking-[0.2em] uppercase text-gold/30 font-mono">
            On-chain &middot; Mempool acceptance &middot; Bitcoin
          </p>
          <p className="text-xs text-muted-foreground/35">
            Powered by{" "}
            <a
              href="https://mempool.space"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gold/30 hover:text-gold/50 transition-colors"
            >
              mempool.space
            </a>
          </p>
        </footer>
      </div>
    </main>
  );
}
