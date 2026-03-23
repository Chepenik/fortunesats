import { FortuneMachine } from "@/components/fortune-machine";

export default function Home() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm space-y-12">
        {/* Hero */}
        <header className="text-center space-y-4">
          <div className="text-4xl">
            🥠
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              Fortune Sats
            </h1>
            <p className="text-[15px] text-muted-foreground leading-relaxed">
              100 sats. One fortune.
              <br />
              <span className="text-muted-foreground/60">
                A tiny ritual powered by Lightning.
              </span>
            </p>
          </div>
        </header>

        {/* Machine */}
        <FortuneMachine />

        {/* Footer */}
        <footer className="space-y-4 text-center">
          <div className="h-px w-12 mx-auto bg-border/50" />
          <div className="space-y-2">
            <p className="text-[11px] tracking-widest uppercase text-muted-foreground/40">
              L402 &middot; Pay per request &middot; Lightning Network
            </p>
            <p className="text-[11px] text-muted-foreground/30">
              Powered by{" "}
              <a
                href="https://mpp.dev/overview"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-4 decoration-muted-foreground/20 hover:text-muted-foreground/50 hover:decoration-muted-foreground/40 transition-colors"
              >
                MoneyDevKit
              </a>
            </p>
          </div>
        </footer>
      </div>
    </main>
  );
}
