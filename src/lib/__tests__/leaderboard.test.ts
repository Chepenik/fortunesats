import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock Redis ──

function makePipeline(execResult: unknown[] = []) {
  return {
    zincrby: vi.fn(),
    zadd: vi.fn(),
    zrange: vi.fn(),
    zrevrank: vi.fn(),
    zscore: vi.fn(),
    hset: vi.fn(),
    hget: vi.fn(),
    exec: vi.fn().mockResolvedValue(execResult),
  };
}

const mockPipeline = vi.fn();
const mockHmget = vi.fn();

const mockRedis = {
  pipeline: mockPipeline,
  hmget: mockHmget,
};

vi.mock("@/lib/redis", () => ({
  getRedis: vi.fn(() => mockRedis),
}));

const {
  recordFortuneReveal,
  recordSatsSpent,
  updateLeaderboardDisplayName,
  getLeaderboard,
} = await import("@/lib/leaderboard");

const DEVICE_ID = "device-abc-123";
const DISPLAY_NAME = "TestUser";

beforeEach(() => {
  vi.clearAllMocks();
});

/* ─── recordFortuneReveal ───────────────────────────────── */

describe("recordFortuneReveal", () => {
  it("sets streak to 1 when device has no prior fortune (first ever)", async () => {
    mockHmget.mockResolvedValueOnce({ lastFortuneAt: null, currentStreak: null });
    const pipe = makePipeline();
    mockPipeline.mockReturnValueOnce(pipe);

    await recordFortuneReveal(DEVICE_ID, DISPLAY_NAME, "common", 100);

    expect(pipe.zadd).toHaveBeenCalledWith("lb:streak", { score: 1, member: DEVICE_ID });
    expect(pipe.hset).toHaveBeenCalledWith(
      `lb:device:${DEVICE_ID}`,
      expect.objectContaining({ currentStreak: "1" }),
    );
    expect(pipe.exec).toHaveBeenCalled();
  });

  it("increments streak when fortune is within 24-hour window", async () => {
    const recentTime = new Date(Date.now() - 60_000).toISOString(); // 1 min ago
    mockHmget.mockResolvedValueOnce({ lastFortuneAt: recentTime, currentStreak: "3" });
    const pipe = makePipeline();
    mockPipeline.mockReturnValueOnce(pipe);

    await recordFortuneReveal(DEVICE_ID, DISPLAY_NAME, "rare", 100);

    // streak should be 3 + 1 = 4
    expect(pipe.zadd).toHaveBeenCalledWith("lb:streak", { score: 4, member: DEVICE_ID });
    expect(pipe.hset).toHaveBeenCalledWith(
      `lb:device:${DEVICE_ID}`,
      expect.objectContaining({ currentStreak: "4" }),
    );
  });

  it("resets streak to 1 when fortune is outside 24-hour window", async () => {
    const oldTime = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(); // 25h ago
    mockHmget.mockResolvedValueOnce({ lastFortuneAt: oldTime, currentStreak: "7" });
    const pipe = makePipeline();
    mockPipeline.mockReturnValueOnce(pipe);

    await recordFortuneReveal(DEVICE_ID, DISPLAY_NAME, "epic", 100);

    expect(pipe.zadd).toHaveBeenCalledWith("lb:streak", { score: 1, member: DEVICE_ID });
  });

  it("increments lb:fortunes for every reveal", async () => {
    mockHmget.mockResolvedValueOnce({ lastFortuneAt: null, currentStreak: null });
    const pipe = makePipeline();
    mockPipeline.mockReturnValueOnce(pipe);

    await recordFortuneReveal(DEVICE_ID, DISPLAY_NAME, "common", 100);

    expect(pipe.zincrby).toHaveBeenCalledWith("lb:fortunes", 1, DEVICE_ID);
  });

  it("increments lb:sats when sats > 0", async () => {
    mockHmget.mockResolvedValueOnce({ lastFortuneAt: null, currentStreak: null });
    const pipe = makePipeline();
    mockPipeline.mockReturnValueOnce(pipe);

    await recordFortuneReveal(DEVICE_ID, DISPLAY_NAME, "common", 100);

    expect(pipe.zincrby).toHaveBeenCalledWith("lb:sats", 100, DEVICE_ID);
  });

  it("skips lb:sats when sats = 0 (pack reveals)", async () => {
    mockHmget.mockResolvedValueOnce({ lastFortuneAt: null, currentStreak: null });
    const pipe = makePipeline();
    mockPipeline.mockReturnValueOnce(pipe);

    await recordFortuneReveal(DEVICE_ID, DISPLAY_NAME, "rare", 0);

    const satsCalls = pipe.zincrby.mock.calls.filter((c) => c[0] === "lb:sats");
    expect(satsCalls).toHaveLength(0);
  });

  it("increments lb:legendary only for legendary rarity", async () => {
    mockHmget.mockResolvedValueOnce({ lastFortuneAt: null, currentStreak: null });
    const legendaryPipe = makePipeline();
    mockPipeline.mockReturnValueOnce(legendaryPipe);

    await recordFortuneReveal(DEVICE_ID, DISPLAY_NAME, "legendary", 100);

    expect(legendaryPipe.zincrby).toHaveBeenCalledWith("lb:legendary", 1, DEVICE_ID);
  });

  it("does not increment lb:legendary for non-legendary rarity", async () => {
    mockHmget.mockResolvedValueOnce({ lastFortuneAt: null, currentStreak: null });
    const pipe = makePipeline();
    mockPipeline.mockReturnValueOnce(pipe);

    await recordFortuneReveal(DEVICE_ID, DISPLAY_NAME, "epic", 100);

    const legendaryCalls = pipe.zincrby.mock.calls.filter((c) => c[0] === "lb:legendary");
    expect(legendaryCalls).toHaveLength(0);
  });

  it("stores displayName and timestamp in device hash", async () => {
    mockHmget.mockResolvedValueOnce({ lastFortuneAt: null, currentStreak: null });
    const pipe = makePipeline();
    mockPipeline.mockReturnValueOnce(pipe);

    await recordFortuneReveal(DEVICE_ID, DISPLAY_NAME, "common", 100);

    expect(pipe.hset).toHaveBeenCalledWith(
      `lb:device:${DEVICE_ID}`,
      expect.objectContaining({
        displayName: DISPLAY_NAME,
        lastFortuneAt: expect.any(String),
      }),
    );
  });

  it("handles Redis failure gracefully without throwing", async () => {
    mockHmget.mockRejectedValueOnce(new Error("Redis unavailable"));

    await expect(
      recordFortuneReveal(DEVICE_ID, DISPLAY_NAME, "common", 100),
    ).resolves.not.toThrow();
  });

  it("returns immediately when Redis is not configured", async () => {
    const { getRedis } = await import("@/lib/redis");
    vi.mocked(getRedis).mockReturnValueOnce(null);

    await expect(
      recordFortuneReveal(DEVICE_ID, DISPLAY_NAME, "common", 100),
    ).resolves.not.toThrow();

    expect(mockPipeline).not.toHaveBeenCalled();
  });
});

/* ─── recordSatsSpent ────────────────────────────────────── */

describe("recordSatsSpent", () => {
  it("pipelines lb:sats increment and device displayName update", async () => {
    const pipe = makePipeline();
    mockPipeline.mockReturnValueOnce(pipe);

    await recordSatsSpent(DEVICE_ID, DISPLAY_NAME, 10_500);

    expect(pipe.zincrby).toHaveBeenCalledWith("lb:sats", 10_500, DEVICE_ID);
    expect(pipe.hset).toHaveBeenCalledWith(`lb:device:${DEVICE_ID}`, { displayName: DISPLAY_NAME });
    expect(pipe.exec).toHaveBeenCalled();
  });

  it("handles Redis failure gracefully without throwing", async () => {
    mockPipeline.mockReturnValueOnce({
      zincrby: vi.fn(),
      hset: vi.fn(),
      exec: vi.fn().mockRejectedValueOnce(new Error("Redis timeout")),
    });

    await expect(recordSatsSpent(DEVICE_ID, DISPLAY_NAME, 10_500)).resolves.not.toThrow();
  });
});

/* ─── updateLeaderboardDisplayName ──────────────────────── */

describe("updateLeaderboardDisplayName", () => {
  it("sets displayName in device hash", async () => {
    const mockHset = vi.fn().mockResolvedValueOnce(1);
    vi.mocked(mockRedis as unknown as { hset?: typeof mockHset }).hset = mockHset;

    // Temporarily patch mockRedis to have hset
    const redisWithHset = { ...mockRedis, hset: mockHset };
    const { getRedis } = await import("@/lib/redis");
    vi.mocked(getRedis).mockReturnValueOnce(redisWithHset as unknown as ReturnType<typeof getRedis>);

    await updateLeaderboardDisplayName(DEVICE_ID, "NewName");

    expect(mockHset).toHaveBeenCalledWith(`lb:device:${DEVICE_ID}`, { displayName: "NewName" });
  });

  it("returns without error when Redis is not configured", async () => {
    const { getRedis } = await import("@/lib/redis");
    vi.mocked(getRedis).mockReturnValueOnce(null);

    await expect(updateLeaderboardDisplayName(DEVICE_ID, "Test")).resolves.not.toThrow();
  });
});

/* ─── getLeaderboard ─────────────────────────────────────── */

describe("getLeaderboard", () => {
  it("returns empty leaderboard when Redis is not configured", async () => {
    const { getRedis } = await import("@/lib/redis");
    vi.mocked(getRedis).mockReturnValueOnce(null);

    const result = await getLeaderboard(null);

    expect(result.fortunes).toEqual([]);
    expect(result.sats).toEqual([]);
    expect(result.legendary).toEqual([]);
    expect(result.streak).toEqual([]);
    expect(result.you).toBeNull();
  });

  it("returns leaderboard entries with display names", async () => {
    // First pipeline: 4 zrange results (no deviceId, so no "you" commands)
    const scoredEntries = ["device-1", 5, "device-2", 3]; // [member, score, ...]
    const mainPipeResult = [
      scoredEntries,           // [0] fortunes
      scoredEntries,           // [1] sats
      ["device-1", 2],         // [2] legendary
      ["device-1", 3],         // [3] streak
    ];
    const mainPipe = makePipeline(mainPipeResult);
    mockPipeline.mockReturnValueOnce(mainPipe);

    // Second pipeline: display names for unique device IDs
    const namePipe = makePipeline(["Alice", "Bob"]);
    mockPipeline.mockReturnValueOnce(namePipe);

    const result = await getLeaderboard(null);

    expect(result.fortunes).toHaveLength(2);
    expect(result.fortunes[0]).toMatchObject({ rank: 1, score: 5, isYou: false });
    expect(result.fortunes[1]).toMatchObject({ rank: 2, score: 3, isYou: false });
    expect(result.you).toBeNull();
  });

  it("marks the current device as isYou in entries", async () => {
    const deviceId = "device-me";
    const mainPipeResult = [
      [deviceId, 10, "device-other", 5],  // fortunes
      [deviceId, 1000, "device-other", 500], // sats
      [deviceId, 1],                          // legendary
      [deviceId, 5],                          // streak
      0,    // zrevrank fortunes → rank 1
      10,   // zscore fortunes
      0,    // zrevrank sats
      1000, // zscore sats
      0,    // zrevrank legendary
      1,    // zscore legendary
      0,    // zrevrank streak
      5,    // zscore streak
      "Me", // hget displayName
    ];
    const mainPipe = makePipeline(mainPipeResult);
    mockPipeline.mockReturnValueOnce(mainPipe);

    const namePipe = makePipeline(["Me", "Other"]);
    mockPipeline.mockReturnValueOnce(namePipe);

    const result = await getLeaderboard(deviceId);

    expect(result.fortunes[0].isYou).toBe(true);
    expect(result.fortunes[1].isYou).toBe(false);
    expect(result.you).not.toBeNull();
    expect(result.you?.fortunes).toMatchObject({ rank: 1, score: 10 });
    expect(result.you?.sats).toMatchObject({ rank: 1, score: 1000 });
  });

  it("returns null 'you' when deviceId has no leaderboard entries", async () => {
    const deviceId = "device-new";
    const mainPipeResult = [
      ["device-other", 5], // fortunes
      ["device-other", 500], // sats
      [],                    // legendary (empty)
      [],                    // streak (empty)
      null, // zrevrank fortunes → not ranked
      null, // zscore fortunes
      null, // zrevrank sats
      null, // zscore sats
      null, // zrevrank legendary
      null, // zscore legendary
      null, // zrevrank streak
      null, // zscore streak
      null, // hget displayName
    ];
    const mainPipe = makePipeline(mainPipeResult);
    mockPipeline.mockReturnValueOnce(mainPipe);

    const namePipe = makePipeline(["Other"]);
    mockPipeline.mockReturnValueOnce(namePipe);

    const result = await getLeaderboard(deviceId);

    expect(result.you).toBeNull();
  });

  it("handles Redis failure gracefully without throwing", async () => {
    mockPipeline.mockReturnValueOnce({
      zrange: vi.fn(),
      zrevrank: vi.fn(),
      zscore: vi.fn(),
      hget: vi.fn(),
      exec: vi.fn().mockRejectedValueOnce(new Error("Redis failure")),
    });

    const result = await getLeaderboard(null);

    expect(result.fortunes).toEqual([]);
    expect(result.you).toBeNull();
  });

  it("skips empty leaderboard result without crashing", async () => {
    const mainPipeResult = [[], [], [], []]; // all empty sets
    const mainPipe = makePipeline(mainPipeResult);
    mockPipeline.mockReturnValueOnce(mainPipe);
    // No second pipeline call needed (no unique IDs to look up)

    const result = await getLeaderboard(null);

    expect(result.fortunes).toEqual([]);
    expect(result.sats).toEqual([]);
  });
});
