import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Fortune Sats — 100 sats. One fortune.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function TwitterImage() {
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
          background: "#050507",
          fontFamily: "system-ui, sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Red glow top */}
        <div
          style={{
            position: "absolute",
            width: 800,
            height: 400,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(196,30,58,0.12) 0%, transparent 70%)",
            top: "-15%",
            left: "50%",
            transform: "translateX(-50%)",
          }}
        />

        {/* Gold glow bottom */}
        <div
          style={{
            position: "absolute",
            width: 600,
            height: 300,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(212,162,87,0.08) 0%, transparent 70%)",
            bottom: "-10%",
            left: "50%",
            transform: "translateX(-50%)",
          }}
        />

        {/* Top ornamental line */}
        <div
          style={{
            position: "absolute",
            top: 40,
            left: "50%",
            transform: "translateX(-50%)",
            width: 120,
            height: 1,
            background:
              "linear-gradient(90deg, transparent, rgba(212,162,87,0.4), transparent)",
          }}
        />

        {/* Fortune cookie */}
        <div style={{ fontSize: 96, marginBottom: 20 }}>🥠</div>

        {/* Title */}
        <div
          style={{
            fontSize: 64,
            fontWeight: 700,
            color: "#f0ece4",
            letterSpacing: "-0.02em",
            marginBottom: 12,
          }}
        >
          Fortune Sats
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: 26,
            display: "flex",
            gap: 12,
            marginBottom: 48,
          }}
        >
          <span style={{ color: "#d4a257" }}>100 sats.</span>
          <span style={{ color: "rgba(240,236,228,0.5)" }}>One fortune.</span>
        </div>

        {/* Bottom pill */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            fontSize: 14,
            fontFamily: "monospace",
            color: "rgba(212,162,87,0.25)",
            letterSpacing: "0.15em",
            textTransform: "uppercase",
          }}
        >
          <span>L402</span>
          <span style={{ color: "rgba(196,30,58,0.3)" }}>&#x2022;</span>
          <span>Lightning Network</span>
          <span style={{ color: "rgba(196,30,58,0.3)" }}>&#x2022;</span>
          <span>Pay per request</span>
        </div>

        {/* Bottom ornamental line */}
        <div
          style={{
            position: "absolute",
            bottom: 40,
            left: "50%",
            transform: "translateX(-50%)",
            width: 120,
            height: 1,
            background:
              "linear-gradient(90deg, transparent, rgba(196,30,58,0.3), transparent)",
          }}
        />
      </div>
    ),
    { ...size },
  );
}
