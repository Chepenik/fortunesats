import type { Metadata } from "next";
import Link from "next/link";
import { decodeFortuneSlug, parseFortune } from "@/lib/og";
import { RARITY_CONFIG, type Rarity } from "@/lib/fortunes";

/* ─── Metadata ──────────────────────────────────────────── */

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const decoded = decodeFortuneSlug(slug);

  if (!decoded) {
    return {
      title: "Fortune Sats",
      description:
        "100 sats. One fortune. A tiny Lightning-powered ritual.",
    };
  }

  const { quote, author } = parseFortune(decoded.text);
  const rarityLabel =
    decoded.rarity !== "common"
      ? `[${RARITY_CONFIG[decoded.rarity].label}] `
      : "";
  const truncatedQuote =
    quote.length > 120 ? quote.slice(0, 117) + "\u2026" : quote;
  const description = `${rarityLabel}\u201C${truncatedQuote}\u201D${author ? ` \u2014 ${author}` : ""}`;

  return {
    title: `Fortune Sats \u2014 ${decoded.rarity !== "common" ? RARITY_CONFIG[decoded.rarity].label + " " : ""}Fortune`,
    description,
    openGraph: {
      title: "Fortune Sats",
      description,
      siteName: "Fortune Sats",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "Fortune Sats",
      description,
    },
  };
}

/* ─── Page ──────────────────────────────────────────────── */

export default async function FortunePage({ params }: Props) {
  const { slug } = await params;
  const decoded = decodeFortuneSlug(slug);

  if (!decoded) {
    return <InvalidFortune />;
  }

  const { text, rarity } = decoded;
  const { quote, author } = parseFortune(text);
  const config = RARITY_CONFIG[rarity];

  return (
    <main className="flex-1 flex flex-col items-center justify-center px-6 py-16 relative overflow-hidden">
      {/* Ambient glows */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full bg-lacquer/[0.04] blur-[120px]" />
        <div className="absolute bottom-[-10%] left-1/2 -translate-x-1/2 w-[500px] h-[300px] rounded-full bg-gold/[0.03] blur-[100px]" />
      </div>

      <div className="relative z-10 w-full max-w-md space-y-10">
        {/* Fortune card */}
        <div
          className={`relative rounded-2xl overflow-hidden scanlines ${config.borderClass} ${
            rarity === "legendary"
              ? "rarity-legendary-border"
              : rarity === "epic"
                ? "rarity-epic-border"
                : ""
          }`}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-lacquer/[0.06] via-[#0c0a0e] to-[#0c0a0e]" />
          <div className="absolute inset-0 bg-gradient-to-br from-gold/[0.02] via-transparent to-lacquer/[0.02]" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 dragon-line" />

          <div className="relative p-8 space-y-6 ornamental-border">
            {/* Rarity badge */}
            {rarity !== "common" && (
              <div className="flex items-center justify-center">
                <RarityBadge rarity={rarity} />
              </div>
            )}

            {/* Cookie */}
            <div className="text-2xl drop-shadow-[0_0_12px_rgba(212,162,87,0.3)]">
              🥠
            </div>

            {/* Fortune text */}
            <blockquote
              className={`text-lg leading-relaxed tracking-tight font-light ${
                rarity === "legendary"
                  ? "text-shimmer-gold"
                  : "text-foreground/90"
              }`}
            >
              {rarity !== "legendary" && (
                <span className="text-gold/60">&ldquo;</span>
              )}
              {rarity === "legendary"
                ? `\u201C${quote}\u201D`
                : quote}
              {rarity !== "legendary" && (
                <span className="text-gold/60">&rdquo;</span>
              )}
            </blockquote>

            {/* Author */}
            {author && (
              <p className="text-sm text-gold/40 italic">
                &mdash; {author}
              </p>
            )}

            {/* Ornamental divider */}
            <div className="dragon-line w-full" />
          </div>
        </div>

        {/* CTA */}
        <div className="space-y-4 text-center">
          <Link
            href="/"
            className="btn-lacquer inline-flex items-center justify-center w-full h-14 rounded-xl text-sm font-semibold tracking-wide transition-all active:scale-[0.98]"
          >
            Get Your Own Fortune
          </Link>

          <p className="text-xs text-gold/30 leading-relaxed">
            <span className="text-gold/50 font-medium">100 sats.</span>{" "}
            One fortune. Paid over Lightning.
          </p>

          <div className="flex items-center justify-center gap-4 text-[10px] tracking-[0.15em] uppercase font-mono text-gold/20">
            <span>L402</span>
            <span className="text-lacquer/25">&middot;</span>
            <span>Lightning Network</span>
            <span className="text-lacquer/25">&middot;</span>
            <span>Pay per request</span>
          </div>
        </div>
      </div>
    </main>
  );
}

/* ─── Sub-components ────────────────────────────────────── */

function RarityBadge({ rarity }: { rarity: Rarity }) {
  const config = RARITY_CONFIG[rarity];
  return (
    <div
      className={`rarity-badge ${config.badgeClass}`}
    >
      <div
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: config.color }}
      />
      {config.label}
    </div>
  );
}

function InvalidFortune() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm space-y-8 text-center">
        <div className="text-5xl">🥠</div>
        <div className="space-y-2">
          <h1 className="text-xl font-semibold text-foreground/80">
            Fortune not found
          </h1>
          <p className="text-sm text-muted-foreground/50">
            This fortune link may have expired or been corrupted.
          </p>
        </div>
        <Link
          href="/"
          className="btn-lacquer inline-flex items-center justify-center w-full h-12 rounded-xl text-sm font-semibold tracking-wide transition-all active:scale-[0.98]"
        >
          Get Your Own Fortune
        </Link>
      </div>
    </main>
  );
}
