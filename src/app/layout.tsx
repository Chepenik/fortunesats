import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SiteNav } from "@/components/site-nav";
import { getFlags } from "@/lib/flags";
import { FORTUNE_POOL_TOTAL } from "@/lib/fortunes";
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
    default: "Fortune Sats - Bitcoin Fortune Oracle Powered by Lightning",
    template: "%s | Fortune Sats",
  },
  description:
    `Request a fortune, pay 100 sats over Lightning, and reveal collectible Bitcoin wisdom from ${FORTUNE_POOL_TOTAL} core fortunes.`,
  icons: {
    icon: "/icon.svg",
  },
  openGraph: {
    title: "Fortune Sats - Bitcoin Fortune Oracle",
    description:
      `Request a fortune, pay 100 sats over Lightning, and reveal collectible Bitcoin wisdom from ${FORTUNE_POOL_TOTAL} core fortunes.`,
    url: "https://fortunesats.com",
    siteName: "Fortune Sats",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Fortune Sats - Bitcoin Fortune Oracle",
    description:
      `Request a fortune, pay 100 sats over Lightning, and reveal collectible Bitcoin wisdom from ${FORTUNE_POOL_TOTAL} core fortunes.`,
    site: "@ConorChepenik",
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
