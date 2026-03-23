import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Fortune Sats — 100 sats. One fortune.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(145deg, #0a0a0a 0%, #1a1a1a 50%, #0f0f0f 100%)",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/* Subtle radial glow */}
        <div
          style={{
            position: "absolute",
            width: 600,
            height: 600,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(232,168,56,0.08) 0%, transparent 70%)",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
          }}
        />

        {/* Fortune cookie */}
        <div style={{ fontSize: 120, marginBottom: 24 }}>🥠</div>

        {/* Title */}
        <div
          style={{
            fontSize: 64,
            fontWeight: 700,
            color: "#ffffff",
            letterSpacing: "-0.02em",
            marginBottom: 16,
          }}
        >
          Fortune Sats
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: 28,
            color: "rgba(255,255,255,0.5)",
            letterSpacing: "0.02em",
            marginBottom: 48,
          }}
        >
          100 sats. One fortune.
        </div>

        {/* Bottom pill */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            fontSize: 16,
            color: "rgba(255,255,255,0.3)",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
          }}
        >
          <span>L402</span>
          <span style={{ color: "rgba(255,255,255,0.15)" }}>·</span>
          <span>Lightning Network</span>
          <span style={{ color: "rgba(255,255,255,0.15)" }}>·</span>
          <span>Pay per request</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
