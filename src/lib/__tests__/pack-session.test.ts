import { describe, it, expect } from "vitest";
import {
  getPackFromCookie,
  resolvePackCredentials,
  packCookieHeader,
  clearPackCookieHeader,
} from "@/lib/pack-session";

function makeReq(cookie?: string): Request {
  const headers = new Headers();
  if (cookie) headers.set("cookie", cookie);
  return new Request("http://localhost/api/pack/status", { headers });
}

describe("getPackFromCookie", () => {
  it("parses valid fsp cookie", () => {
    const req = makeReq("fsp=abc-123%7Csecret-xyz");
    const result = getPackFromCookie(req);
    expect(result).toEqual({ orderId: "abc-123", secret: "secret-xyz" });
  });

  it("returns null for missing cookie", () => {
    const req = makeReq();
    expect(getPackFromCookie(req)).toBeNull();
  });

  it("returns null for malformed cookie (no separator)", () => {
    const req = makeReq("fsp=noseparator");
    expect(getPackFromCookie(req)).toBeNull();
  });

  it("returns null for empty value", () => {
    const req = makeReq("fsp=");
    expect(getPackFromCookie(req)).toBeNull();
  });

  it("handles cookie among other cookies", () => {
    const req = makeReq("other=val; fsp=order-1%7Csec-1; another=v2");
    const result = getPackFromCookie(req);
    expect(result).toEqual({ orderId: "order-1", secret: "sec-1" });
  });
});

describe("resolvePackCredentials", () => {
  it("prefers cookie over body", () => {
    const req = makeReq("fsp=cookie-order%7Ccookie-secret");
    const result = resolvePackCredentials(req, {
      orderId: "cookie-order",
      secret: "body-secret",
    });
    expect(result).toEqual({
      orderId: "cookie-order",
      secret: "cookie-secret",
    });
  });

  it("falls back to body when no cookie", () => {
    const req = makeReq();
    const result = resolvePackCredentials(req, {
      orderId: "body-order",
      secret: "body-secret",
    });
    expect(result).toEqual({ orderId: "body-order", secret: "body-secret" });
  });

  it("returns null when no cookie and incomplete body", () => {
    const req = makeReq();
    expect(resolvePackCredentials(req, { orderId: "only-id" })).toBeNull();
    expect(resolvePackCredentials(req, {})).toBeNull();
  });

  it("handles mismatched orderId — uses body credentials for different pack", () => {
    const req = makeReq("fsp=old-order%7Cold-secret");
    const result = resolvePackCredentials(req, {
      orderId: "new-order",
      secret: "new-secret",
    });
    expect(result).toEqual({ orderId: "new-order", secret: "new-secret" });
  });

  it("returns null for mismatched orderId without body secret", () => {
    const req = makeReq("fsp=old-order%7Cold-secret");
    const result = resolvePackCredentials(req, { orderId: "new-order" });
    expect(result).toBeNull();
  });
});

describe("packCookieHeader", () => {
  it("produces valid Set-Cookie header", () => {
    const header = packCookieHeader("order-123", "secret-abc");
    expect(header).toContain("fsp=");
    expect(header).toContain("order-123");
    expect(header).toContain("secret-abc");
    expect(header).toContain("HttpOnly");
    expect(header).toContain("SameSite=Lax");
    expect(header).toContain("Path=/");
  });
});

describe("clearPackCookieHeader", () => {
  it("produces Max-Age=0", () => {
    const header = clearPackCookieHeader();
    expect(header).toContain("Max-Age=0");
    expect(header).toContain("fsp=");
  });
});
