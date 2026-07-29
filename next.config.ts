import type { NextConfig } from "next";

// Connect-src whitelist: same origin + Vercel Analytics (web vitals beacon).
// All Strike / mempool.space calls are server-side only and don't need to be listed here.
const CSP = [
  "default-src 'self'",
  // Next.js App Router emits inline <script> tags for RSC payloads and bootstrapping.
  "script-src 'self' 'unsafe-inline'",
  // Tailwind v4 and shadcn/ui components may inject inline styles.
  "style-src 'self' 'unsafe-inline'",
  // data: allows inline SVG QR codes rendered to <img>; no external image hosts used.
  "img-src 'self' data:",
  // Browser-side fetches: same-origin API routes + Vercel Analytics vitals beacon.
  "connect-src 'self' https://vitals.vercel-insights.com",
  // Next.js self-hosts Google Fonts at build time; no external font origins needed.
  "font-src 'self'",
  // No web workers in use.
  "worker-src 'none'",
  // Prevent <base> tag injection from redirecting all relative URLs.
  "base-uri 'self'",
  // No Flash / browser plugins.
  "object-src 'none'",
  // Form submissions must stay on the same origin.
  "form-action 'self'",
  // Supersedes X-Frame-Options in modern browsers.
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          { key: "Content-Security-Policy", value: CSP },
        ],
      },
    ];
  },
};

export default nextConfig;
