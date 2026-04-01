import { randomUUID } from "crypto";

const COOKIE_NAME = "fsd"; // fortune sats device
const INITIALS_COOKIE = "fsi"; // fortune sats initials
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60; // 1 year

const ADJECTIVES = [
  "Ancient", "Crimson", "Ember", "Golden", "Iron",
  "Jade", "Mystic", "Neon", "Sacred", "Shadow",
  "Silent", "Storm", "Swift", "Twilight", "Wild",
];

const NOUNS = [
  "Dragon", "Phoenix", "Oracle", "Serpent", "Tiger",
  "Crane", "Lotus", "Sage", "Wolf", "Hawk",
  "Fox", "Raven", "Falcon", "Sphinx", "Koi",
];

/**
 * Blocked initials (2-4 uppercase letters).
 * Kept intentionally small — only clear slurs and profanity.
 */
const BLOCKED_INITIALS = new Set([
  // 3-letter
  "ASS", "FAG", "FUK", "FUC", "CUM", "TIT", "DIK", "COK", "NIG", "WTF",
  "KKK", "STD", "SUK", "GAY", "SEX", "XXX", "HOE", "JEW",
  // 4-letter
  "FUCK", "SHIT", "DICK", "SLUT", "CUNT", "COCK", "DAMN", "ANAL",
  "ANUS", "PISS", "TITS", "DUMB", "NAZI", "RAPE", "HOMO", "KIKE",
  "DYKE", "SPIC", "GOOK", "NIGA",
]);

/* ─── Cookie helpers ────────────────────────────────────── */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseCookie(req: Request, name: string): string | null {
  const cookie = req.headers.get("cookie") ?? "";
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? match[1] : null;
}

/** Read device ID from the cookie header. Returns null if missing or malformed. */
export function getDeviceId(req: Request): string | null {
  const raw = parseCookie(req, COOKIE_NAME);
  if (!raw) return null;
  return UUID_RE.test(raw) ? raw : null;
}

/** Read custom initials from the cookie header (already validated on write) */
export function getInitials(req: Request): string | null {
  const raw = parseCookie(req, INITIALS_COOKIE);
  if (!raw) return null;
  // Re-validate on read (defense-in-depth against cookie tampering)
  return validateInitials(raw);
}

/** Get existing device ID or create a new one */
export function getOrCreateDeviceId(req: Request): { deviceId: string; isNew: boolean } {
  const existing = getDeviceId(req);
  if (existing) return { deviceId: existing, isNew: false };
  return { deviceId: randomUUID(), isNew: true };
}

/** Build Set-Cookie header for device ID */
export function deviceCookieHeader(deviceId: string): string {
  return `${COOKIE_NAME}=${deviceId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}`;
}

/** Build Set-Cookie header for initials (non-HttpOnly so client can read it) */
export function initialsCookieHeader(initials: string): string {
  return `${INITIALS_COOKIE}=${initials}; Path=/; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}`;
}

/** Build a Set-Cookie header that clears the initials cookie */
export function clearInitialsCookieHeader(): string {
  return `${INITIALS_COOKIE}=; Path=/; SameSite=Lax; Max-Age=0`;
}

/* ─── Initials validation ───────────────────────────────── */

/**
 * Validate and normalize initials.
 * Returns uppercase 2-4 letter string, or null if invalid.
 */
export function validateInitials(raw: string): string | null {
  // Strip whitespace, uppercase
  const cleaned = raw.trim().toUpperCase();

  // Must be 2-4 ASCII letters only
  if (!/^[A-Z]{2,4}$/.test(cleaned)) return null;

  // Blocklist check
  if (BLOCKED_INITIALS.has(cleaned)) return null;

  return cleaned;
}

/* ─── Display name ──────────────────────────────────────── */

/** Short hex suffix derived from device ID (4 uppercase hex chars). */
function hexSuffix(deviceId: string): string {
  return deviceId.replace(/-/g, "").slice(24, 28).toUpperCase();
}

/**
 * Deterministic pseudonym from device ID.
 * e.g. "Golden-Dragon-A3F1"
 */
export function getDisplayName(deviceId: string): string {
  const hex = deviceId.replace(/-/g, "");
  const adjIdx = parseInt(hex.slice(0, 4), 16) % ADJECTIVES.length;
  const nounIdx = parseInt(hex.slice(4, 8), 16) % NOUNS.length;
  if (Number.isNaN(adjIdx) || Number.isNaN(nounIdx)) {
    return `Anon-${hexSuffix(deviceId) || "0000"}`;
  }
  return `${ADJECTIVES[adjIdx]}-${NOUNS[nounIdx]}-${hexSuffix(deviceId)}`;
}

/**
 * Resolve the best display name for a device.
 * If initials are set: "CC-A3F1"
 * Otherwise: "Golden-Dragon-A3F1"
 */
export function resolveDisplayName(deviceId: string, initials: string | null): string {
  if (initials) return `${initials}-${hexSuffix(deviceId)}`;
  return getDisplayName(deviceId);
}

/** Resolve display name from a request (reads both cookies). */
export function resolveDisplayNameFromReq(req: Request, deviceId: string): string {
  return resolveDisplayName(deviceId, getInitials(req));
}

/** Append the device cookie to a Response (mutates headers) */
export function attachDeviceCookie(res: Response, deviceId: string): Response {
  res.headers.append("Set-Cookie", deviceCookieHeader(deviceId));
  return res;
}
