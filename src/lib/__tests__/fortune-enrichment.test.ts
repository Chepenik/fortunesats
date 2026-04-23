import { describe, it, expect, vi, beforeAll } from "vitest";

// Prevent Redis connection attempts in modules that lazy-load Redis.
vi.mock("@/lib/redis", () => ({
  getRedis: vi.fn(() => null),
}));

// Allow all requests through — rate limiting is not under test here.
vi.mock("@/lib/ratelimit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue(null),
}));

import { agentFortunes, agentFortuneById } from "@/lib/fortunes";

// ── Fortune enrichment — data integrity ──────────────────────

describe("fortune enrichment — data integrity", () => {
  it("every fortune has all required fields", () => {
    const validRarities = new Set(["legendary", "epic", "rare", "common"]);
    const validCategories = new Set([
      "stoicism", "philosophy", "eastern", "sovereignty", "growth", "fortune", "wit",
    ]);

    for (const f of agentFortunes) {
      expect(f.id, `id missing on: ${f.text.slice(0, 40)}`).toBeTruthy();
      expect(f.text, "text missing").toBeTruthy();
      expect(validRarities.has(f.rarity), `invalid rarity: ${f.rarity}`).toBe(true);
      expect(validCategories.has(f.category), `invalid category: ${f.category}`).toBe(true);
      expect(Array.isArray(f.tags), "tags must be array").toBe(true);
      expect(f.tags.length, "tags must not be empty").toBeGreaterThan(0);
    }
  });

  it("all fortune IDs are unique (no hash collisions)", () => {
    const ids = agentFortunes.map((f) => f.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it("agentFortuneById maps every fortune by its id", () => {
    expect(agentFortuneById.size).toBe(agentFortunes.length);
    for (const f of agentFortunes) {
      expect(agentFortuneById.get(f.id)).toBe(f);
    }
  });
});

// ── Author extraction ─────────────────────────────────────────

describe("author extraction", () => {
  it("extracts author from em-dash attribution", () => {
    const f = agentFortunes.find((f) => f.text === "The obstacle is the way. — Marcus Aurelius");
    expect(f?.author).toBe("Marcus Aurelius");
  });

  it("returns null for unattributed fortunes", () => {
    const f = agentFortunes.find((f) => f.text === "Proof of work is truth without permission.");
    expect(f?.author).toBeNull();
  });

  it("returns null when 'author' is too long to be a name", () => {
    // "Fortune favors the bold." has a genuine short attribution, just verify
    // no fortune with an attribution longer than 60 chars gets an author
    const tooLong = agentFortunes.filter(
      (f) => f.author !== null && f.author.length >= 60,
    );
    expect(tooLong).toHaveLength(0);
  });
});

// ── Category inference ────────────────────────────────────────

describe("category inference", () => {
  it("classifies stoic authors as stoicism", () => {
    const seneca = agentFortunes.find((f) => f.text.includes("— Seneca"));
    expect(seneca?.category).toBe("stoicism");

    const marcus = agentFortunes.find((f) => f.text === "The obstacle is the way. — Marcus Aurelius");
    expect(marcus?.category).toBe("stoicism");
  });

  it("classifies eastern philosophers as eastern", () => {
    const laoTzu = agentFortunes.find((f) => f.text.includes("— Lao Tzu"));
    expect(laoTzu?.category).toBe("eastern");

    const rumi = agentFortunes.find((f) => f.text.includes("— Rumi"));
    expect(rumi?.category).toBe("eastern");
  });

  it("classifies western philosophers as philosophy", () => {
    const socrates = agentFortunes.find((f) => f.text.includes("— Socrates"));
    expect(socrates?.category).toBe("philosophy");

    const jung = agentFortunes.find((f) => f.text.includes("— Carl Jung"));
    expect(jung?.category).toBe("philosophy");
  });

  it("classifies sovereignty keywords as sovereignty", () => {
    const pow = agentFortunes.find((f) => f.text === "Proof of work is truth without permission.");
    expect(pow?.category).toBe("sovereignty");

    const fix = agentFortunes.find((f) => f.text === "Fix the money, fix the incentives.");
    expect(fix?.category).toBe("sovereignty");

    // "sat" (singular) does not match the "sats" keyword — use a fortune that does
    const sats = agentFortunes.find((f) => f.text.includes("A sovereign mind"));
    expect(sats?.category).toBe("sovereignty");
  });

  it("classifies fortune-telling phrases as fortune", () => {
    const door = agentFortunes.find((f) => f.text === "A door you thought was closed is quietly opening.");
    expect(door?.category).toBe("fortune");
  });

  it("classifies wit keywords as wit", () => {
    const dog = agentFortunes.find((f) => f.text.includes("dog thinks"));
    expect(dog?.category).toBe("wit");

    const alphabet = agentFortunes.find((f) => f.text.includes("alphabet has range"));
    expect(alphabet?.category).toBe("wit");

    const shipIt = agentFortunes.find((f) => f.text.includes("Ship it"));
    expect(shipIt?.category).toBe("wit");
  });

  it("defaults to growth for unclassified fortunes", () => {
    const f = agentFortunes.find((f) => f.text === "Hard choices, easy life. Easy choices, hard life.");
    expect(f?.category).toBe("growth");
  });
});

// ── Tag derivation ────────────────────────────────────────────

describe("tag derivation", () => {
  it("always includes category as first tag", () => {
    for (const f of agentFortunes) {
      expect(f.tags[0], `first tag should be category for: ${f.text.slice(0, 40)}`).toBe(f.category);
    }
  });

  it("includes 'attributed' tag when author is present", () => {
    const attributed = agentFortunes.filter((f) => f.author !== null);
    expect(attributed.length).toBeGreaterThan(0);
    for (const f of attributed) {
      expect(f.tags, `${f.author} fortune should have attributed tag`).toContain("attributed");
    }
  });

  it("includes 'original' tag when no author", () => {
    const original = agentFortunes.filter((f) => f.author === null);
    expect(original.length).toBeGreaterThan(0);
    for (const f of original) {
      expect(f.tags, `unattributed fortune should have original tag`).toContain("original");
    }
  });

  it("never has both 'attributed' and 'original' on the same fortune", () => {
    for (const f of agentFortunes) {
      const hasAttributed = f.tags.includes("attributed");
      const hasOriginal = f.tags.includes("original");
      expect(hasAttributed && hasOriginal, `${f.text.slice(0, 40)} has both tags`).toBe(false);
    }
  });
});

// ── Agent route handler ───────────────────────────────────────

describe("GET /api/agent/fortune", () => {
  let GET: (req: Request) => Promise<Response>;

  beforeAll(async () => {
    const mod = await import("@/app/api/agent/fortune/route");
    GET = mod.GET;
  });

  function req(path = "") {
    return new Request(`http://localhost/api/agent/fortune${path}`);
  }

  it("returns fortune + pricing with no query params", async () => {
    const res = await GET(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.fortune).toBeDefined();
    expect(body.fortune.id).toBeTruthy();
    expect(body.fortune.text).toBeTruthy();
    expect(body.pricing.amount).toBe(100);
    expect(body.pricing.currency).toBe("SAT");
    expect(body.meta).toBeUndefined();
  });

  it("returns pool metadata when ?meta=true", async () => {
    const res = await GET(req("?meta=true"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.meta.total).toBeGreaterThan(0);
    expect(body.meta.categories).toBeDefined();
    expect(body.meta.rarities).toBeDefined();
  });

  it("fetches a specific fortune by id", async () => {
    const target = agentFortunes[0];
    const res = await GET(req(`?id=${target.id}`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.fortune.id).toBe(target.id);
    expect(body.fortune.text).toBe(target.text);
  });

  it("returns 404 for unknown id", async () => {
    const res = await GET(req("?id=zzzzzzz"));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("not_found");
  });

  it("returns fortune filtered by valid category", async () => {
    const res = await GET(req("?category=stoicism"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.fortune.category).toBe("stoicism");
  });

  it("returns 400 for invalid category", async () => {
    const res = await GET(req("?category=astrology"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("invalid_category");
  });

  it("returns fortune filtered by valid rarity", async () => {
    const res = await GET(req("?rarity=legendary"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.fortune.rarity).toBe("legendary");
  });

  it("returns 400 for invalid rarity", async () => {
    const res = await GET(req("?rarity=mythic"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("invalid_rarity");
  });

  it("returns fortune from intersection when both category and rarity given", async () => {
    const res = await GET(req("?category=stoicism&rarity=legendary"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.fortune.category).toBe("stoicism");
    expect(body.fortune.rarity).toBe("legendary");
  });

  it("id lookup also returns meta when ?meta=true", async () => {
    const target = agentFortunes[0];
    const res = await GET(req(`?id=${target.id}&meta=true`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.fortune.id).toBe(target.id);
    expect(body.meta).toBeDefined();
    expect(body.meta.total).toBeGreaterThan(0);
  });
});
