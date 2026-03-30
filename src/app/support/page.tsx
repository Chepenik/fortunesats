import { SupportView } from "@/components/support-view";

export const metadata = {
  title: "Support — Fortune Sats",
  description: "Support FortuneSats with an on-chain Bitcoin donation. Every sat helps keep the oracle alive.",
};

export default function SupportPage() {
  return (
    <main className="relative flex-1 flex flex-col items-center px-6 py-16 overflow-hidden">
      {/* Ambient glows */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full bg-lacquer/[0.04] blur-[120px]" />
        <div className="absolute bottom-[-10%] left-1/2 -translate-x-1/2 w-[500px] h-[300px] rounded-full bg-gold/[0.03] blur-[100px]" />
      </div>

      <div className="relative w-full max-w-md space-y-8">
        {/* Header */}
        <header className="text-center space-y-4">
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="h-px w-8 bg-gradient-to-r from-transparent to-gold/20" />
            <div className="h-1 w-1 rounded-full bg-lacquer/40" />
            <div className="h-px w-8 bg-gradient-to-l from-transparent to-gold/20" />
          </div>

          <div className="text-4xl drop-shadow-[0_0_16px_rgba(212,162,87,0.15)]">
            &#x26A1;
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight neon-text text-foreground">
              Support the Oracle
            </h1>
            <p className="text-sm text-muted-foreground/60 leading-relaxed max-w-xs mx-auto">
              FortuneSats is free to build, open source, and powered by sats.
              Every contribution helps keep the fortunes flowing.
            </p>
          </div>
        </header>

        {/* Support content */}
        <SupportView />

        {/* Footer */}
        <footer className="text-center space-y-4">
          <div className="dragon-line w-16 mx-auto" />
          <div className="flex items-center justify-center gap-4 text-[11px]">
            <a
              href="https://github.com/Chepenik/fortunesats"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gold/30 hover:text-gold/50 transition-colors"
            >
              GitHub
            </a>
            <span className="text-gold/10">|</span>
            <a
              href="https://x.com/ConorChepenik"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gold/30 hover:text-gold/50 transition-colors"
            >
              @ConorChepenik
            </a>
          </div>
        </footer>
      </div>
    </main>
  );
}
