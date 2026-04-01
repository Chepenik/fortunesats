import type { MetadataRoute } from "next";
import { fortunes } from "@/lib/fortunes";
import { encodeFortuneSlug } from "@/lib/og";

const BASE = "https://fortunesats.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE, lastModified: now, changeFrequency: "weekly", priority: 1.0 },
    { url: `${BASE}/collection`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${BASE}/leaderboard`, lastModified: now, changeFrequency: "daily", priority: 0.7 },
    { url: `${BASE}/support`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${BASE}/pack`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
  ];

  const fortunePages: MetadataRoute.Sitemap = fortunes.map((f) => ({
    url: `${BASE}/fortune/${encodeFortuneSlug(f.text, f.rarity)}`,
    lastModified: now,
    changeFrequency: "yearly" as const,
    priority: f.rarity === "legendary" ? 0.9 : f.rarity === "epic" ? 0.8 : 0.7,
  }));

  return [...staticPages, ...fortunePages];
}
