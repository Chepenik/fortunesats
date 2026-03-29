import { ImageResponse } from "next/og";
import {
  decodeFortuneSlug,
  parseFortune,
  getQuoteFontSize,
  OG_RARITY_COLORS,
  RARITY_LABELS,
} from "@/lib/og";

export const runtime = "edge";
export const alt = "Fortune Sats — A Lightning-powered fortune";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OGImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const decoded = decodeFortuneSlug(slug);

  if (!decoded) {
    return fallbackImage();
  }

  const { text, rarity } = decoded;
  const { quote, author } = parseFortune(text);
  const colors = OG_RARITY_COLORS[rarity];
  const fontSize = getQuoteFontSize(quote);

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
        {/* ── Rarity-colored glow (top) ── */}
        <div
          style={{
            position: "absolute",
            width: 700,
            height: 350,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${colors.glow} 0%, transparent 70%)`,
            top: "-12%",
            left: "50%",
            transform: "translateX(-50%)",
          }}
        />

        {/* ── Warm gold glow (bottom) ── */}
        <div
          style={{
            position: "absolute",
            width: 500,
            height: 250,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(212,162,87,0.06) 0%, transparent 70%)",
            bottom: "-8%",
            left: "50%",
            transform: "translateX(-50%)",
          }}
        />

        {/* ── Red accent glow (left edge) ── */}
        <div
          style={{
            position: "absolute",
            width: 200,
            height: 400,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(196,30,58,0.05) 0%, transparent 70%)",
            top: "20%",
            left: "-5%",
          }}
        />

        {/* ── Top ornamental line ── */}
        <div
          style={{
            position: "absolute",
            top: 36,
            left: "50%",
            transform: "translateX(-50%)",
            width: 100,
            height: 1,
            background:
              "linear-gradient(90deg, transparent, rgba(212,162,87,0.35), transparent)",
          }}
        />

        {/* ── Rarity badge ── */}
        {rarity !== "common" && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 18px",
              borderRadius: 9999,
              border: `1px solid ${colors.badgeBorder}`,
              background: colors.badge,
              marginBottom: 24,
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: colors.accent,
              }}
            />
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.15em",
                color: colors.badgeText,
                fontFamily: "monospace",
              }}
            >
              {RARITY_LABELS[rarity]}
            </span>
          </div>
        )}

        {/* ── Fortune cookie ── */}
        <div style={{ fontSize: 40, marginBottom: 20, opacity: 0.9 }}>
          🥠
        </div>

        {/* ── Fortune text ── */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            maxWidth: 900,
            padding: "0 60px",
          }}
        >
          <div
            style={{
              fontSize,
              fontWeight: 400,
              color: "#f0ece4",
              textAlign: "center",
              lineHeight: 1.4,
              letterSpacing: "-0.01em",
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
            }}
          >
            <span style={{ color: "rgba(212,162,87,0.6)" }}>{"\u201C"}</span>
            <span>{quote}</span>
            <span style={{ color: "rgba(212,162,87,0.6)" }}>{"\u201D"}</span>
          </div>

          {/* ── Author attribution ── */}
          {author && (
            <div
              style={{
                fontSize: 20,
                color: "rgba(212,162,87,0.45)",
                marginTop: 16,
                fontStyle: "italic",
                letterSpacing: "0.02em",
              }}
            >
              {"\u2014"} {author}
            </div>
          )}
        </div>

        {/* ── Divider ── */}
        <div
          style={{
            width: 60,
            height: 1,
            background: `linear-gradient(90deg, transparent, ${colors.accent}40, transparent)`,
            marginTop: 32,
            marginBottom: 32,
          }}
        />

        {/* ── Bottom branding ── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            fontSize: 13,
            fontFamily: "monospace",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
          }}
        >
          <span style={{ color: "rgba(240,236,228,0.35)" }}>Fortune Sats</span>
          <span style={{ color: "rgba(196,30,58,0.25)" }}>{"\u2022"}</span>
          <span style={{ color: "rgba(212,162,87,0.2)" }}>100 sats</span>
          <span style={{ color: "rgba(196,30,58,0.25)" }}>{"\u2022"}</span>
          <span style={{ color: "rgba(212,162,87,0.2)" }}>Lightning</span>
        </div>

        {/* ── Bottom ornamental line ── */}
        <div
          style={{
            position: "absolute",
            bottom: 36,
            left: "50%",
            transform: "translateX(-50%)",
            width: 100,
            height: 1,
            background:
              "linear-gradient(90deg, transparent, rgba(196,30,58,0.25), transparent)",
          }}
        />
      </div>
    ),
    { ...size },
  );
}

/** Fallback for invalid/corrupted slugs — render the generic card */
function fallbackImage() {
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
        <div style={{ fontSize: 96, marginBottom: 20 }}>🥠</div>
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
        <div style={{ fontSize: 26, display: "flex", gap: 12 }}>
          <span style={{ color: "#d4a257" }}>100 sats.</span>
          <span style={{ color: "rgba(240,236,228,0.5)" }}>One fortune.</span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
