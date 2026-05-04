import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SiteNav } from "@/components/site-nav";
import { getFlags } from "@/lib/flags";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://fortunesats.com"),
  title: {
    default: "Fortune Sats — Bitcoin Fortune Oracle Powered by Lightning",
    template: "%s | Fortune Sats",
  },
  description:
    "Pay 100 sats over Lightning, receive a wisdom fortune. A Bitcoin-native fortune oracle with 124 collectible quotes across 4 rarity tiers.",
  icons: {
    icon: "/icon.svg",
  },
  openGraph: {
    title: "Fortune Sats — Bitcoin Fortune Oracle",
    description:
      "Pay 100 sats over Lightning, receive a wisdom fortune. 124 collectible quotes across 4 rarity tiers.",
    siteName: "Fortune Sats",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Fortune Sats — Bitcoin Fortune Oracle",
    description:
      "Pay 100 sats over Lightning, receive a wisdom fortune. 124 collectible quotes across 4 rarity tiers.",
  },
  alternates: {
    canonical: "https://fortunesats.com",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { leaderboardEnabled } = getFlags();
  const hiddenRoutes: string[] = [];
  if (!leaderboardEnabled) hiddenRoutes.push("/leaderboard");

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
    >
      <body className="min-h-full flex flex-col selection:bg-lacquer/20 selection:text-gold">
        <SiteNav hiddenRoutes={hiddenRoutes} />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
