import type { Metadata } from "next";
import Link from "next/link";
import { getGift } from "@/lib/gift";
import { RARITY_CONFIG } from "@/lib/fortunes";
import { GiftClaimClient } from "./claim-client";

/* ─── Metadata ──────────────────────────────────────────── */

type Props = {
  params: Promise<{ token: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const gift = await getGift(token);

  if (!gift || gift.status === "expired") {
    return {
      title: "Gift Not Found",
      description: "This gift fortune link may have expired or been claimed.",
      robots: { index: false },
    };
  }

  const rarityLabel = RARITY_CONFIG[gift.rarity].label;
  const isClaimed = gift.status === "claimed";

  const title = isClaimed
    ? "Gift Fortune Claimed | Fortune Sats"
    : "You Received a Fortune Gift! | Fortune Sats";

  const description = isClaimed
    ? `This ${rarityLabel} gift fortune has already been claimed.`
    : `Someone sent you a ${rarityLabel} fortune gift! Open it to reveal your wisdom.`;

  return {
    title,
    description,
    robots: { index: false },
    openGraph: {
      title,
      description,
      siteName: "Fortune Sats",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

/* ─── Page ──────────────────────────────────────────────── */

export default async function GiftClaimPage({ params }: Props) {
  const { token } = await params;
  const gift = await getGift(token);

  if (!gift) {
    return <GiftNotFound />;
  }

  if (gift.status === "expired") {
    return <GiftExpired />;
  }

  if (gift.status === "claimed") {
    return <GiftAlreadyClaimed rarity={gift.rarity} />;
  }

  // Gift is "paid" — show sealed card for recipient to claim
  return <GiftClaimClient token={token} rarity={gift.rarity} />;
}

/* ─── Static sub-components ───────────────────────────────── */

function GiftNotFound() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm space-y-8 text-center">
        <div className="text-5xl">🎁</div>
        <div className="space-y-2">
          <h1 className="text-xl font-semibold text-foreground/80">Gift not found</h1>
          <p className="text-sm text-muted-foreground/50">
            This gift link may have expired or is invalid.
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

function GiftExpired() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm space-y-8 text-center">
        <div className="text-5xl">🎁</div>
        <div className="space-y-2">
          <h1 className="text-xl font-semibold text-foreground/80">Gift expired</h1>
          <p className="text-sm text-muted-foreground/50">
            This fortune gift has expired. Gift fortunes are claimable for 30 days.
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

function GiftAlreadyClaimed({ rarity }: { rarity: string }) {
  const config = RARITY_CONFIG[rarity as keyof typeof RARITY_CONFIG];
  return (
    <main className="flex-1 flex flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm space-y-8 text-center">
        <div className="text-5xl">🎁</div>
        <div className="space-y-2">
          <h1 className="text-xl font-semibold text-foreground/80">Already claimed</h1>
          <p className="text-sm text-muted-foreground/50">
            This <span style={{ color: config?.color }}>{config?.label}</span> gift fortune has already been opened.
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
