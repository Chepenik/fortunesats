import { FortunePack } from "@/components/fortune-pack";
import Link from "next/link";

export const metadata = {
  title: "Fortune Pack — Fortune Sats",
  description:
    "100 fortunes for 10,000 sats. Pay on-chain, accepted instantly on mempool detection.",
};

export default function PackPage() {
  return (
    <main className="relative flex-1 flex flex-col items-center justify-center px-6 py-16 overflow-hidden">
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
        <footer className="space-y-5 text-center">
          <div className="dragon-line w-16 mx-auto" />
          <div className="space-y-3">
            <Link
              href="/"
              className="inline-block text-[11px] text-gold/30 hover:text-gold/50 transition-colors"
            >
              &larr; Single fortune (100 sats, Lightning)
            </Link>
            <Link
              href="/leaderboard"
              className="inline-block text-[11px] text-gold/20 hover:text-gold/40 transition-colors"
            >
              🏆 Hall of Fortunes
            </Link>
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
            <a
              href="https://github.com/Chepenik/fortunesats"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center text-muted-foreground/20 hover:text-gold/40 transition-colors mt-1"
              aria-label="View source on GitHub"
            >
              <svg
                viewBox="0 0 24 24"
                fill="currentColor"
                className="h-4 w-4"
                aria-hidden="true"
              >
                <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2Z" />
              </svg>
            </a>
          </div>
        </footer>
      </div>
    </main>
  );
}
