import { describe, it, expect, vi } from "vitest";

// Mock Redis as null (disabled) for baseline
vi.mock("@/lib/redis", () => ({
  getRedis: vi.fn(() => null),
}));

const { checkRateLimit } = await import("@/lib/ratelimit");

describe("checkRateLimit", () => {
  it("returns null (allow) when Redis is not configured", async () => {
    const req = new Request("http://localhost/api/test", {
      headers: { "x-forwarded-for": "1.2.3.4" },
    });
    const result = await checkRateLimit(req, {
      prefix: "test",
      limit: 1,
      window: "1 m",
    });
    expect(result).toBeNull();
  });
});
