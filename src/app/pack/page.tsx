import { FortunePack } from "@/components/fortune-pack";

export const metadata = {
  title: "Fortune Pack — Fortune Sats",
  description:
    "100 fortunes for 10,000 sats. Pay on-chain, accepted instantly on mempool detection.",
};

export default function PackPage() {
  return (
    <main className="relative flex-1 flex flex-col items-center justify-center px-6 py-12 overflow-hidden">
      {/* Ambient radial glows */}
      <div className="pointer-events-none absolute inset-0">
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
        <FortunePack />

        {/* Footer */}
        <footer className="space-y-4 text-center">
          <div className="dragon-line w-16 mx-auto" />
          <p className="text-[10px] tracking-[0.2em] uppercase text-gold/25 font-mono">
            On-chain &middot; Mempool acceptance &middot; Bitcoin
          </p>
          <p className="text-[11px] text-muted-foreground/30">
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
