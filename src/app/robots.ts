import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/checkout/", "/fortune/success", "/gift/success"],
      },
    ],
    sitemap: "https://fortunesats.com/sitemap.xml",
  };
}
