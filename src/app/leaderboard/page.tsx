import { LeaderboardView } from "@/components/leaderboard-view";
import { getFlags } from "@/lib/flags";
import Link from "next/link";

export const metadata = {
  title: "Hall of Fortunes — Fortune Sats",
  description: "Global leaderboard for Fortune Sats — see who has revealed the most fortunes.",
};

export default function LeaderboardPage() {
  const { leaderboardEnabled } = getFlags();

  return (
    <main className="relative flex-1 flex flex-col items-center px-6 py-12 overflow-hidden">
      {/* Ambient glows */}
      <div className="pointer-events-none absolute inset-0 flex flex-col">
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

          <div className="text-4xl">🏆</div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight neon-text text-foreground">
              Hall of Fortunes
            </h1>
            <p className="text-sm text-muted-foreground/60">
              The seekers who returned most often.
            </p>
          </div>
        </header>

        {/* Leaderboard */}
        {leaderboardEnabled ? (
          <LeaderboardView />
        ) : (
          <div className="text-center py-8 space-y-3">
            <p className="text-sm text-muted-foreground/60">The leaderboard is temporarily hidden.</p>
            <Link href="/" className="inline-block text-xs text-gold/50 hover:text-gold/70 transition-colors mt-2">
              &larr; Back to Fortune Sats
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
