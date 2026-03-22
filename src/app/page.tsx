import { FortuneMachine } from "@/components/fortune-machine";

export default function Home() {
  return (
    <main className="flex-1 flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <div className="text-5xl">🥠</div>
          <h1 className="text-2xl font-bold tracking-tight">Fortune Sats</h1>
          <p className="text-muted-foreground text-sm">
            Pay <span className="font-mono text-foreground">10 sats</span>, get
            a fortune.
          </p>
        </div>
        <FortuneMachine />
        <footer className="text-center text-xs text-muted-foreground space-y-1">
          <p>
            Powered by{" "}
            <a
              href="https://mpp.dev/overview"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4 hover:text-foreground transition-colors"
            >
              MoneyDevKit
            </a>{" "}
            &middot; L402 Protocol
          </p>
          <p className="font-mono opacity-60">HTTP 402 Payment Required</p>
        </footer>
      </div>
    </main>
  );
}
