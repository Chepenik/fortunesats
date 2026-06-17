import type { NextConfig } from "next";

// CSP directives:
// - script-src includes 'unsafe-inline' (required by Next.js App Router hydration scripts)
//   and va.vercel-scripts.com (Vercel Analytics dev-mode script source)
// - style-src includes 'unsafe-inline' (required by Tailwind and Next.js inline styles)
// - object-src/frame-src 'none' blocks plugin and iframe injection vectors
// - base-uri 'self' prevents base-tag hijacking attacks
// - form-action 'self' prevents off-site form submissions
// - frame-ancestors 'none' reinforces X-Frame-Options for modern browsers
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
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
          { key: "Content-Security-Policy", value: csp },
        ],
      },
    ];
  },
};

export default nextConfig;
