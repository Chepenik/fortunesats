import { describe, it, expect, vi } from "vitest";
import { agentFortunes } from "@/lib/fortunes";

// Mock rate limiter — always allow in tests
vi.mock("@/lib/ratelimit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue(null),
}));

// Import route after mocks are registered
const { GET } = await import("@/app/api/agent/fortune/route");

function makeRequest(params?: Record<string, string>): Request {
  const url = new URL("http://localhost/api/agent/fortune");
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }
  return new Request(url.toString());
}

describe("GET /api/agent/fortune — no filters", () => {
  it("returns a valid fortune with pricing", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body.fortune.id).toBe("string");
    expect(body.fortune.id.length).toBeGreaterThan(0);
    expect(typeof body.fortune.text).toBe("string");
    expect(["legendary", "epic", "rare", "common"]).toContain(body.fortune.rarity);
    expect(body.pricing).toEqual({ amount: 100, currency: "SAT" });
  });

  it("omits meta by default", async () => {
    const res = await GET(makeRequest());
    const body = await res.json();
    expect(body.meta).toBeUndefined();
  });
});

describe("GET /api/agent/fortune — id lookup", () => {
  it("returns the correct fortune for a known id", async () => {
    const target = agentFortunes[0];
    const res = await GET(makeRequest({ id: target.id }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.fortune.id).toBe(target.id);
    expect(body.fortune.text).toBe(target.text);
    expect(body.fortune.rarity).toBe(target.rarity);
    expect(body.fortune.category).toBe(target.category);
  });

  it("returns 404 for an unknown id", async () => {
    const res = await GET(makeRequest({ id: "does-not-exist" }));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("not_found");
  });

  it("includes meta on id lookup when ?meta=true", async () => {
    const target = agentFortunes[0];
    const res = await GET(makeRequest({ id: target.id, meta: "true" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.meta.total).toBe(agentFortunes.length);
    expect(typeof body.meta.categories).toBe("object");
    expect(typeof body.meta.rarities).toBe("object");
  });
});

describe("GET /api/agent/fortune — category filter", () => {
  it("returns a fortune in the requested category", async () => {
    const res = await GET(makeRequest({ category: "stoicism" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.fortune.category).toBe("stoicism");
  });

  it("returns 400 for an unknown category", async () => {
    const res = await GET(makeRequest({ category: "invalid-category" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("invalid_category");
  });

  it("each valid category returns a fortune in that category", async () => {
    const categories = ["stoicism", "philosophy", "eastern", "sovereignty", "growth", "fortune", "wit"];
    for (const cat of categories) {
      const hasFortunes = agentFortunes.some((f) => f.category === cat);
      if (!hasFortunes) continue; // skip if no data for category
      const res = await GET(makeRequest({ category: cat }));
      expect(res.status, `category ${cat} should return 200`).toBe(200);
      const body = await res.json();
      expect(body.fortune.category).toBe(cat);
    }
  });
});

describe("GET /api/agent/fortune — rarity filter", () => {
  it("returns a fortune of the requested rarity", async () => {
    const res = await GET(makeRequest({ rarity: "legendary" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.fortune.rarity).toBe("legendary");
  });

  it("returns 400 for an unknown rarity", async () => {
    const res = await GET(makeRequest({ rarity: "mythic" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("invalid_rarity");
  });
});

describe("GET /api/agent/fortune — combined category + rarity filter", () => {
  it("returns a fortune matching both filters when intersection is non-empty", async () => {
    // stoicism + legendary is a known-good intersection (Marcus Aurelius / Seneca legendaries)
    const res = await GET(makeRequest({ category: "stoicism", rarity: "legendary" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.fortune.category).toBe("stoicism");
    expect(body.fortune.rarity).toBe("legendary");
  });

  it("returns an error when the intersection is empty", async () => {
    // Find a category+rarity pair guaranteed to have zero intersection
    const allCats = ["stoicism", "philosophy", "eastern", "sovereignty", "growth", "fortune", "wit"];
    const allRarities = ["legendary", "epic", "rare", "common"];

    let emptyCat: string | null = null;
    let emptyRarity: string | null = null;
    outer: for (const cat of allCats) {
      for (const rarity of allRarities) {
        if (!agentFortunes.some((f) => f.category === cat && f.rarity === rarity)) {
          emptyCat = cat;
          emptyRarity = rarity;
          break outer;
        }
      }
    }

    if (!emptyCat || !emptyRarity) {
      // All intersections covered — skip
      return;
    }

    const res = await GET(makeRequest({ category: emptyCat, rarity: emptyRarity }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(["invalid_category", "invalid_rarity"]).toContain(body.error.code);
  });
});

describe("GET /api/agent/fortune — meta flag", () => {
  it("includes meta when ?meta=true", async () => {
    const res = await GET(makeRequest({ meta: "true" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.meta).toBeDefined();
    expect(body.meta.total).toBe(agentFortunes.length);
    expect(body.meta.categories).toBeDefined();
    expect(body.meta.rarities).toBeDefined();
    // Sanity: all known categories are represented
    expect(body.meta.categories.stoicism).toBeGreaterThan(0);
    expect(body.meta.rarities.common).toBeGreaterThan(0);
  });

  it("omits meta when ?meta=false", async () => {
    const res = await GET(makeRequest({ meta: "false" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.meta).toBeUndefined();
  });
});

describe("GET /api/agent/fortune — disabled state", () => {
  it("returns 503 when agentApi feature flag is off", async () => {
    const { config } = await import("@/lib/config");
    const original = config.features.agentApi;
    config.features.agentApi = false;
    try {
      const res = await GET(makeRequest());
      expect(res.status).toBe(503);
      const body = await res.json();
      expect(body.error.code).toBe("agent_api_disabled");
    } finally {
      config.features.agentApi = original;
    }
  });
});
