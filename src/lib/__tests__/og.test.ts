import { describe, it, expect } from "vitest";
import { encodeFortuneSlug, decodeFortuneSlug } from "@/lib/og";

describe("fortune slug encoding/decoding", () => {
  it("roundtrips text and rarity correctly", () => {
    const text = "The obstacle is the way. — Marcus Aurelius";
    const rarity = "legendary" as const;
    const slug = encodeFortuneSlug(text, rarity);
    const decoded = decodeFortuneSlug(slug);
    expect(decoded).toEqual({ text, rarity });
  });

  it("returns null for corrupted slugs", () => {
    expect(decodeFortuneSlug("not-valid-base64!!!")).toBeNull();
  });

  it("returns null for invalid rarity", () => {
    // Manually encode with an invalid rarity
    const json = JSON.stringify({ t: "test", r: "mythic" });
    const bytes = new TextEncoder().encode(json);
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    const slug = btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    expect(decodeFortuneSlug(slug)).toBeNull();
  });
});
