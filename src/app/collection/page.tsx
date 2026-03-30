import { CollectionView } from "@/components/collection-view";

export const metadata = {
  title: "My Collection — Fortune Sats",
  description: "Browse every fortune you have revealed. Track your rarity progress across 170 fortunes.",
};

export default function CollectionPage() {
  return (
    <main className="relative flex-1 flex flex-col items-center px-6 py-12 overflow-hidden">
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

          <div className="text-4xl">🗂️</div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight neon-text text-foreground">
              My Collection
            </h1>
            <p className="text-sm text-muted-foreground/60">
              Every fortune you have revealed, preserved.
            </p>
          </div>
        </header>

        {/* Collection */}
        <CollectionView />
      </div>
    </main>
  );
}
