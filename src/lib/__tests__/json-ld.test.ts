import { describe, it, expect } from "vitest";
import { serializeJsonLd } from "@/lib/og";

describe("serializeJsonLd", () => {
  it("escapes < so text cannot close the surrounding script tag", () => {
    const out = serializeJsonLd({ text: "</script><script>alert(1)</script>" });
    expect(out).not.toContain("<");
    expect(JSON.parse(out).text).toBe("</script><script>alert(1)</script>");
  });
});
