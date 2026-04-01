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
  title: "Fortune Sats",
  description:
    "100 sats. One fortune. A tiny Lightning-powered ritual using the L402 protocol.",
  icons: {
    icon: "/icon.svg",
  },
  openGraph: {
    title: "Fortune Sats",
    description:
      "100 sats. One fortune. A tiny Lightning-powered ritual using the L402 protocol.",
    siteName: "Fortune Sats",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Fortune Sats",
    description:
      "100 sats. One fortune. A tiny Lightning-powered ritual using the L402 protocol.",
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
