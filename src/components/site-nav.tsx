"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/* ─── Nav items ─────────────────────────────────────────── */

const NAV_ITEMS = [
  { href: "/collection", label: "Collection" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/support", label: "Support" },
] as const;

/* ─── Component ─────────────────────────────────────────── */

export function SiteNav() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-50 w-full backdrop-blur-md bg-background/70 border-b border-gold/[0.06]">
      <div className="max-w-2xl mx-auto px-4 h-12 flex items-center justify-between">
        {/* Logo / Home link */}
        <Link
          href="/"
          className="flex items-center gap-2 group"
        >
          <span className="text-lg drop-shadow-[0_0_8px_rgba(212,162,87,0.2)] group-hover:drop-shadow-[0_0_12px_rgba(212,162,87,0.35)] transition-all">
            🥠
          </span>
          <span className="text-sm font-bold tracking-tight text-foreground/90 group-hover:text-foreground transition-colors hidden sm:inline">
            Fortune Sats
          </span>
        </Link>

        {/* Nav links */}
        <div className="flex items-center gap-1">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? "bg-gold/[0.08] text-gold border border-gold/15"
                    : "text-muted-foreground/50 hover:text-gold/70 hover:bg-gold/[0.04] border border-transparent"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
