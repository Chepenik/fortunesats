export const runtime = "edge";
export const alt = "Fortune Sats — A Lightning-powered fortune";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Shares the same rendering as the OG image — kept as a separate file
// because Next.js requires static `runtime`/`size`/`contentType` exports.
export { default } from "./opengraph-image";
