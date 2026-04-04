import { getDeviceId } from "@/lib/device-id";
import { checkRateLimit } from "@/lib/ratelimit";
import {
  getServerCollection,
  setServerCollection,
  getServerStreak,
  setServerStreak,
} from "@/lib/collection-sync";
import { mergeCollections, type CollectedFortune } from "@/lib/collection";
import { mergeStreaks, type StreakData } from "@/lib/streak";
import type { Rarity } from "@/lib/fortunes";

const VALID_RARITIES = new Set(["legendary", "epic", "rare", "common"]);

/**
 * GET /api/collection — Hydrate client collection from Redis.
 * Returns { collection, streak } for the current device.
 */
export async function GET(req: Request) {
  const deviceId = getDeviceId(req);
  if (!deviceId) {
    return Response.json({ collection: [], streak: null });
  }

  const [collection, streak] = await Promise.all([
    getServerCollection(deviceId),
    getServerStreak(deviceId),
  ]);

  return Response.json({ collection, streak });
}

/**
 * POST /api/collection — Sync local collection + streak to Redis.
 * Body: { collection: CollectedFortune[], streak?: StreakData }
 * Two-way merges with server data, persists merged result, returns it.
 */
export async function POST(req: Request) {
  const limited = await checkRateLimit(req, { prefix: "col-sync", limit: 10, window: "1 m" });
  if (limited) return limited;

  const deviceId = getDeviceId(req);
  if (!deviceId) {
    return Response.json(
      { error: { code: "no_device", message: "Device cookie required" } },
      { status: 401 },
    );
  }

  let body: { collection?: unknown; streak?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { error: { code: "invalid_body", message: "JSON body required" } },
      { status: 400 },
    );
  }

  // Validate collection shape
  const localCollection = validateCollection(body.collection);
  if (!localCollection) {
    return Response.json(
      { error: { code: "invalid_collection", message: "Invalid collection format" } },
      { status: 400 },
    );
  }

  // Read server state
  const [serverCollection, serverStreak] = await Promise.all([
    getServerCollection(deviceId),
    getServerStreak(deviceId),
  ]);

  // Merge collections
  const mergedCollection = mergeCollections(localCollection, serverCollection);

  // Merge streaks if provided
  let mergedStreak = serverStreak;
  const localStreak = validateStreak(body.streak);
  if (localStreak) {
    mergedStreak = mergeStreaks(localStreak, serverStreak);
  }

  // Persist merged results
  await Promise.all([
    setServerCollection(deviceId, mergedCollection),
    setServerStreak(deviceId, mergedStreak),
  ]);

  return Response.json({ collection: mergedCollection, streak: mergedStreak });
}

/* ─── Validation helpers ─────────────────────────────────── */

function validateCollection(raw: unknown): CollectedFortune[] | null {
  if (!Array.isArray(raw)) return null;
  if (raw.length > 500) return null; // sanity cap

  const result: CollectedFortune[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") return null;
    const { text, rarity, firstPulled, pullCount } = item as Record<string, unknown>;
    if (typeof text !== "string" || text.length === 0 || text.length > 500) return null;
    if (typeof rarity !== "string" || !VALID_RARITIES.has(rarity)) return null;
    if (typeof firstPulled !== "string") return null;
    if (typeof pullCount !== "number" || pullCount < 1 || !Number.isFinite(pullCount)) return null;

    result.push({ text, rarity: rarity as Rarity, firstPulled, pullCount: Math.floor(pullCount) });
  }
  return result;
}

function validateStreak(raw: unknown): StreakData | null {
  if (!raw || typeof raw !== "object") return null;
  const { current, best, total, lastDate } = raw as Record<string, unknown>;
  if (typeof current !== "number" || !Number.isFinite(current)) return null;
  if (typeof best !== "number" || !Number.isFinite(best)) return null;
  if (typeof total !== "number" || !Number.isFinite(total)) return null;
  if (lastDate !== null && typeof lastDate !== "string") return null;

  return {
    current: Math.max(0, Math.floor(current)),
    best: Math.max(0, Math.floor(best)),
    total: Math.max(0, Math.floor(total)),
    lastDate: typeof lastDate === "string" ? lastDate : null,
  };
}
