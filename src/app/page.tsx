import type { Metadata } from "next";
import { FortuneMachine } from "@/components/fortune-machine";
import { GiftButton } from "@/components/gift-button";
import { ActivityFeed } from "@/components/activity-feed";
import { InitialsEditor } from "@/components/initials-editor";
import { DragonLoader } from "@/components/dragon/DragonLoader";
import { getFlags } from "@/lib/flags";
import { fortunes } from "@/lib/fortunes";
import { encodeFortuneSlug, parseFortune } from "@/lib/og";
import Link from "next/link";

export const metadata: Metadata = {
  alternates: { canonical: "https://fortunesats.com" },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Fortune Sats",
  url: "https://fortunesats.com",
  description:
    "Pay 100 sats over Lightning, receive a wisdom fortune. A Bitcoin-native fortune oracle with 119 collectible quotes.",
};

export default function Home() {
  const { fortuneSingleEnabled, fortunePackEnabled, activityFeedEnabled, freeFortunePromo, giftEnabled } = getFlags();

  return (
    <main className="relative flex-1 flex flex-col items-center justify-center px-6 py-12 overflow-hidden">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* 3D Dragon — background layer, homepage only */}
      <div
        className="absolute inset-0 z-0 pointer-events-none opacity-80"
        aria-hidden="true"
      >
        <DragonLoader />
      </div>

      {/* Ambient radial glows */}
      <div className="pointer-events-none absolute inset-0 z-[1] flex flex-col">
        <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full bg-lacquer/[0.04] blur-[120px]" />
        <div className="absolute bottom-[-10%] left-1/2 -translate-x-1/2 w-[500px] h-[300px] rounded-full bg-gold/[0.03] blur-[100px]" />
        <div className="absolute top-[20%] right-[-10%] w-[200px] h-[200px] rounded-full bg-cyan/[0.02] blur-[80px]" />
      </div>

      <div className="relative z-[2] w-full max-w-sm space-y-10">
        {/* Hero */}
        <header className="text-center space-y-5">
          {/* Ornamental top line */}
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="h-px w-8 bg-gradient-to-r from-transparent to-gold/20" />
            <div className="h-1 w-1 rounded-full bg-lacquer/40" />
            <div className="h-px w-8 bg-gradient-to-l from-transparent to-gold/20" />
          </div>

          <div className="text-6xl drop-shadow-[0_0_20px_rgba(212,162,87,0.15)]">
            🥠
          </div>

          <div className="space-y-3">
            <h1 className="text-4xl font-bold tracking-tight neon-text text-foreground">
              Fortune Sats
            </h1>
            <p className="text-lg leading-relaxed">
              {freeFortunePromo ? (
                <>
                  <span className="text-cyan font-medium">Free fortune.</span>{" "}
                  <span className="text-foreground/80">Limited time.</span>
                </>
              ) : (
                <>
                  <span className="text-gold font-medium">100 sats.</span>{" "}
                  <span className="text-foreground/80">One fortune.</span>
                </>
              )}
              <br />
              <span className="text-muted-foreground/70 text-base">
                A ritual powered by Lightning.
              </span>
            </p>
          </div>
        </header>

        {/* Machine */}
        {fortuneSingleEnabled ? (
          <FortuneMachine freePromo={freeFortunePromo} />
        ) : (
          <div className="text-center py-8 space-y-2">
            <p className="text-sm text-muted-foreground/60">Fortunes are temporarily unavailable.</p>
            <p className="text-xs text-gold/30">Check back soon.</p>
          </div>
        )}

        {/* Gift CTA */}
        {giftEnabled && <GiftButton />}

        {/* Live activity feed */}
        {activityFeedEnabled && <ActivityFeed />}

        {/* Initials editor */}
        <InitialsEditor />

        {/* Featured wisdom — internal links for SEO */}
        <nav className="space-y-3" aria-label="Featured fortunes">
          <p className="text-[11px] tracking-[0.2em] uppercase text-gold/35 font-mono text-center">
            Featured wisdom
          </p>
          <div className="space-y-1.5">
            {fortunes
              .filter((f) => f.rarity === "legendary")
              .slice(0, 4)
              .map((f) => {
                const { quote, author } = parseFortune(f.text);
                const shortQuote = quote.length > 50 ? quote.slice(0, 47) + "\u2026" : quote;
                return (
                  <Link
                    key={f.text}
                    href={`/fortune/${encodeFortuneSlug(f.text, f.rarity)}`}
                    className="block px-3 py-2.5 rounded-lg text-xs text-muted-foreground/45 hover:text-gold/60 hover:bg-gold/[0.03] transition-colors leading-relaxed"
                  >
                    &ldquo;{shortQuote}&rdquo;{author ? ` \u2014 ${author}` : ""}
                  </Link>
                );
              })}
          </div>
          <div className="flex justify-center gap-4 text-xs">
            <Link href="/collection" className="text-gold/45 hover:text-gold/65 transition-colors">
              View collection &rarr;
            </Link>
            <Link href="/leaderboard" className="text-gold/45 hover:text-gold/65 transition-colors">
              Leaderboard &rarr;
            </Link>
          </div>
        </nav>

        {/* Footer */}
        <footer className="space-y-4 text-center">
          <div className="dragon-line w-16 mx-auto" />

          <div className="space-y-2">
            {fortunePackEnabled && (
              <Link
                href="/pack"
                className="inline-block text-xs text-gold/50 hover:text-gold/70 transition-colors"
              >
                Fortune Pack &rarr; 100 fortunes for 10,000 sats (on-chain)
              </Link>
            )}
            <p className="text-xs tracking-[0.15em] uppercase text-gold/40 font-mono">
              Pay per fortune &middot; Lightning Network
            </p>
          </div>

          {/* Powered by + social */}
          <div className="space-y-3 pt-1">
            <p className="text-xs text-muted-foreground/60">
              Powered by{" "}
              <a
                href="https://moneydevkit.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gold/50 hover:text-gold/70 transition-colors"
              >
                MoneyDevKit
              </a>
            </p>
            <div className="flex items-center justify-center gap-5">
              <a
                href="https://github.com/Chepenik/fortunesats"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center text-muted-foreground/40 hover:text-gold/60 transition-colors p-1"
                aria-label="View source on GitHub"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="h-5 w-5"
                  aria-hidden="true"
                >
                  <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2Z" />
                </svg>
              </a>
              <a
                href="https://x.com/ConorChepenik"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center text-muted-foreground/40 hover:text-gold/60 transition-colors p-1"
                aria-label="Follow on X"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="h-5 w-5"
                  aria-hidden="true"
                >
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}
