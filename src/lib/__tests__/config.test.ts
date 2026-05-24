import { describe, it, expect, vi, afterEach } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function loadConfig() {
  const { config } = await import("@/lib/config");
  return config;
}

describe("config defaults", () => {
  it("has correct default pricing", async () => {
    const config = await loadConfig();
    expect(config.pricing.fortuneSingle).toBe(100);
    expect(config.pricing.fortuneGift).toBe(200);
    expect(config.pricing.fortunePack).toBe(10_000);
    expect(config.pricing.packSize).toBe(100);
  });

  it("has correct default feature flags", async () => {
    const config = await loadConfig();
    expect(config.features.agentApi).toBe(true);
    expect(config.features.leaderboard).toBe(true);
    expect(config.features.streaks).toBe(true);
    expect(config.features.collections).toBe(true);
    expect(config.features.sharing).toBe(true);
    expect(config.features.promos).toBe(false);
  });
});

describe("envInt parsing", () => {
  it("applies a valid fortune price override", async () => {
    vi.stubEnv("FS_FORTUNE_PRICE", "250");
    vi.resetModules();
    const config = await loadConfig();
    expect(config.pricing.fortuneSingle).toBe(250);
  });

  it("applies a valid pack price override", async () => {
    vi.stubEnv("FS_PACK_PRICE", "5000");
    vi.resetModules();
    const config = await loadConfig();
    expect(config.pricing.fortunePack).toBe(5_000);
  });

  it("applies a valid pack size override", async () => {
    vi.stubEnv("FS_PACK_SIZE", "50");
    vi.resetModules();
    const config = await loadConfig();
    expect(config.pricing.packSize).toBe(50);
  });

  it("falls back to default for a non-numeric string", async () => {
    vi.stubEnv("FS_FORTUNE_PRICE", "free");
    vi.resetModules();
    const config = await loadConfig();
    expect(config.pricing.fortuneSingle).toBe(100);
  });

  it("falls back to default for an empty string", async () => {
    vi.stubEnv("FS_FORTUNE_PRICE", "");
    vi.resetModules();
    const config = await loadConfig();
    expect(config.pricing.fortuneSingle).toBe(100);
  });

  it("falls back to default for float input (parseInt truncates, but NaN path not hit)", async () => {
    vi.stubEnv("FS_FORTUNE_PRICE", "99.9");
    vi.resetModules();
    const config = await loadConfig();
    // parseInt("99.9") === 99 — finite, so 99 is used
    expect(config.pricing.fortuneSingle).toBe(99);
  });
});

describe("envBool parsing", () => {
  it('disables agentApi when set to "false"', async () => {
    vi.stubEnv("FS_AGENT_API", "false");
    vi.resetModules();
    const config = await loadConfig();
    expect(config.features.agentApi).toBe(false);
  });

  it('keeps agentApi enabled when set to "true"', async () => {
    vi.stubEnv("FS_AGENT_API", "true");
    vi.resetModules();
    const config = await loadConfig();
    expect(config.features.agentApi).toBe(true);
  });

  it('treats "1" as false (only "true" is accepted)', async () => {
    vi.stubEnv("FS_AGENT_API", "1");
    vi.resetModules();
    const config = await loadConfig();
    // config.ts envBool uses v === "true" (strict), unlike flags.ts which also accepts "1"
    expect(config.features.agentApi).toBe(false);
  });

  it("falls back to default for an empty string", async () => {
    vi.stubEnv("FS_AGENT_API", "");
    vi.resetModules();
    const config = await loadConfig();
    expect(config.features.agentApi).toBe(true);
  });
});

describe("rarity weights", () => {
  it("weights sum to 1.0", async () => {
    const config = await loadConfig();
    const { legendary, epic, rare, common } = config.rarity.weights;
    expect(legendary + epic + rare + common).toBeCloseTo(1.0);
  });

  it("legendary is rarest (smallest weight)", async () => {
    const config = await loadConfig();
    const { legendary, epic, rare, common } = config.rarity.weights;
    expect(legendary).toBeLessThan(epic);
    expect(epic).toBeLessThan(rare);
    expect(rare).toBeLessThan(common);
  });

  it("all weights are positive", async () => {
    const config = await loadConfig();
    for (const w of Object.values(config.rarity.weights)) {
      expect(w).toBeGreaterThan(0);
    }
  });
});
