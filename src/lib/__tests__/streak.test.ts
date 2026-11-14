import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import { getStreak, recordFortune, type StreakData } from "@/lib/streak";

/* ─── localStorage mock ─────────────────────────────────── */

const store: Record<string, string> = {};

beforeAll(() => {
  if (typeof globalThis.window === "undefined") {
    // @ts-expect-error — minimal window shim for SSR guard
    globalThis.window = {};
  }

  Object.defineProperty(globalThis, "localStorage", {
    value: {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, val: string) => { store[key] = val; },
      removeItem: (key: string) => { delete store[key]; },
    },
    writable: true,
    configurable: true,
  });

  vi.useFakeTimers();
});

beforeEach(() => {
  Object.keys(store).forEach((k) => delete store[k]);
});

afterAll(() => {
  vi.useRealTimers();
});

/* ─── Helpers ───────────────────────────────────────────── */

function seed(data: StreakData) {
  store["fortunesats:streak"] = JSON.stringify(data);
}

function setDate(dateStr: string) {
  vi.setSystemTime(new Date(dateStr + "T12:00:00.000Z"));
}

/* ═══════════════════════════════════════════════════════════
   getStreak
   ═══════════════════════════════════════════════════════════ */

describe("getStreak", () => {
  it("returns empty streak when nothing stored", () => {
    setDate("2025-06-01");
    const s = getStreak();
    expect(s).toEqual({ current: 0, best: 0, total: 0, lastDate: null });
  });

  it("returns stored streak", () => {
    const data: StreakData = { current: 3, best: 5, total: 10, lastDate: "2025-01-15" };
    seed(data);
    expect(getStreak()).toEqual(data);
  });

  it("returns empty streak on malformed JSON", () => {
    store["fortunesats:streak"] = "not-json{{{";
    expect(getStreak()).toEqual({ current: 0, best: 0, total: 0, lastDate: null });
  });
});

/* ═══════════════════════════════════════════════════════════
   recordFortune — first purchase
   ═══════════════════════════════════════════════════════════ */

describe("recordFortune — first purchase", () => {
  it("sets streak=1, total=1, best=1 on first ever pull", () => {
    setDate("2025-06-01");
    const result = recordFortune();
    expect(result.current).toBe(1);
    expect(result.best).toBe(1);
    expect(result.total).toBe(1);
    expect(result.lastDate).toBe("2025-06-01");
  });

  it("persists the result to localStorage", () => {
    setDate("2025-06-01");
    recordFortune();
    const saved = JSON.parse(store["fortunesats:streak"]);
    expect(saved.current).toBe(1);
    expect(saved.lastDate).toBe("2025-06-01");
  });
});

/* ═══════════════════════════════════════════════════════════
   recordFortune — same-day repeat
   ═══════════════════════════════════════════════════════════ */

describe("recordFortune — same day", () => {
  it("increments total but does not extend streak", () => {
    setDate("2025-06-01");
    // Seed: already pulled once today
    seed({ current: 1, best: 1, total: 1, lastDate: "2025-06-01" });
    const result = recordFortune();
    expect(result.current).toBe(1);
    expect(result.total).toBe(2);
    expect(result.lastDate).toBe("2025-06-01");
  });

  it("does not update best on same-day repeat", () => {
    setDate("2025-06-01");
    seed({ current: 1, best: 1, total: 1, lastDate: "2025-06-01" });
    const result = recordFortune();
    expect(result.best).toBe(1);
  });
});

/* ═══════════════════════════════════════════════════════════
   recordFortune — consecutive days
   ═══════════════════════════════════════════════════════════ */

describe("recordFortune — consecutive days", () => {
  it("extends streak on the next calendar day", () => {
    setDate("2025-06-02");
    seed({ current: 1, best: 1, total: 1, lastDate: "2025-06-01" });
    const result = recordFortune();
    expect(result.current).toBe(2);
    expect(result.total).toBe(2);
    expect(result.lastDate).toBe("2025-06-02");
  });

  it("updates best when streak exceeds previous best", () => {
    setDate("2025-06-03");
    seed({ current: 2, best: 2, total: 2, lastDate: "2025-06-02" });
    const result = recordFortune();
    expect(result.current).toBe(3);
    expect(result.best).toBe(3);
  });

  it("does not lower best when streak is below previous best", () => {
    setDate("2025-06-11");
    // Previous best was 3, current streak restarted to 1 yesterday
    seed({ current: 1, best: 3, total: 5, lastDate: "2025-06-10" });
    const result = recordFortune();
    expect(result.current).toBe(2);
    expect(result.best).toBe(3);
  });
});

/* ═══════════════════════════════════════════════════════════
   recordFortune — gap (streak reset)
   ═══════════════════════════════════════════════════════════ */

describe("recordFortune — gap resets streak", () => {
  it("resets streak to 1 after a 2-day gap", () => {
    setDate("2025-06-03"); // skipped June 2
    seed({ current: 1, best: 1, total: 1, lastDate: "2025-06-01" });
    const result = recordFortune();
    expect(result.current).toBe(1);
    expect(result.total).toBe(2);
    expect(result.lastDate).toBe("2025-06-03");
  });

  it("resets streak after a long gap and preserves best", () => {
    setDate("2025-06-01");
    seed({ current: 2, best: 2, total: 2, lastDate: "2025-01-01" }); // 5 months ago
    const result = recordFortune();
    expect(result.current).toBe(1);
    expect(result.best).toBe(2);
    expect(result.total).toBe(3);
    expect(result.lastDate).toBe("2025-06-01");
  });
});
