import { describe, it, expect, vi } from "vitest";

// Disable Redis so checkRateLimit always allows
vi.mock("@/lib/redis", () => ({
  getRedis: vi.fn(() => null),
}));

// withAgentPayment is a pass-through, so GET === the inner handler
const { GET } = await import("@/app/api/agent/fortune/route");
const { agentFortunes } = await import("@/lib/fortunes");

function req(path: string): Request {
  return new Request(`http://localhost${path}`);
}

describe("GET /api/agent/fortune", () => {
  it("returns a valid fortune with all required fields", async () => {
    const res = await GET(req("/api/agent/fortune"));
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(typeof data.fortune.id).toBe("string");
    expect(data.fortune.id.length).toBeGreaterThan(0);
    expect(typeof data.fortune.text).toBe("string");
    expect(["legendary", "epic", "rare", "common"]).toContain(data.fortune.rarity);
    expect(["stoicism", "philosophy", "eastern", "sovereignty", "growth", "fortune", "wit"]).toContain(data.fortune.category);
    expect(Array.isArray(data.fortune.tags)).toBe(true);
    expect(data.fortune.tags.length).toBeGreaterThan(0);
  });

  it("includes pricing in the default response", async () => {
    const res = await GET(req("/api/agent/fortune"));
    const data = await res.json();

    expect(data.pricing).toBeDefined();
    expect(data.pricing.currency).toBe("SAT");
    expect(typeof data.pricing.amount).toBe("number");
    expect(data.pricing.amount).toBeGreaterThan(0);
  });

  it("omits meta by default", async () => {
    const res = await GET(req("/api/agent/fortune"));
    const data = await res.json();
    expect(data.meta).toBeUndefined();
  });

  it("includes meta when ?meta=true", async () => {
    const res = await GET(req("/api/agent/fortune?meta=true"));
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.meta).toBeDefined();
    expect(data.meta.total).toBe(agentFortunes.length);
    expect(typeof data.meta.categories).toBe("object");
    expect(typeof data.meta.rarities).toBe("object");
    // Spot-check: known categories present
    expect(data.meta.categories.stoicism).toBeGreaterThan(0);
    expect(data.meta.rarities.common).toBeGreaterThan(0);
  });

  it("fetches a specific fortune by valid ID", async () => {
    const target = agentFortunes[0];
    const res = await GET(req(`/api/agent/fortune?id=${target.id}`));
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.fortune.id).toBe(target.id);
    expect(data.fortune.text).toBe(target.text);
    expect(data.fortune.rarity).toBe(target.rarity);
  });

  it("returns 404 for unknown fortune ID", async () => {
    const res = await GET(req("/api/agent/fortune?id=does-not-exist"));
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error.code).toBe("not_found");
  });

  it("filters by valid category", async () => {
    const res = await GET(req("/api/agent/fortune?category=stoicism"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.fortune.category).toBe("stoicism");
  });

  it("returns 400 for invalid category", async () => {
    const res = await GET(req("/api/agent/fortune?category=nonsense"));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.code).toBe("invalid_category");
  });

  it("filters by valid rarity", async () => {
    const res = await GET(req("/api/agent/fortune?rarity=legendary"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.fortune.rarity).toBe("legendary");
  });

  it("returns 400 for invalid rarity", async () => {
    const res = await GET(req("/api/agent/fortune?rarity=mythic"));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.code).toBe("invalid_rarity");
  });

  it("applies category + rarity intersection", async () => {
    // Find a category + rarity combo that exists
    const stoicCommon = agentFortunes.find(
      (f) => f.category === "stoicism" && f.rarity === "common",
    );
    if (!stoicCommon) return; // skip if pool doesn't have this combo

    const res = await GET(req("/api/agent/fortune?category=stoicism&rarity=common"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.fortune.category).toBe("stoicism");
    expect(data.fortune.rarity).toBe("common");
  });

  it("?id= lookup also respects ?meta=true", async () => {
    const target = agentFortunes[5];
    const res = await GET(req(`/api/agent/fortune?id=${target.id}&meta=true`));
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.fortune.id).toBe(target.id);
    expect(data.meta).toBeDefined();
    expect(data.meta.total).toBe(agentFortunes.length);
  });
});
