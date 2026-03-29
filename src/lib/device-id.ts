import { randomUUID } from "crypto";

const COOKIE_NAME = "fsd"; // fortune sats device
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

/** Read device ID from the cookie header */
export function getDeviceId(req: Request): string | null {
  const cookie = req.headers.get("cookie") ?? "";
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
  return match ? match[1] : null;
}

/** Get existing device ID or create a new one */
export function getOrCreateDeviceId(req: Request): { deviceId: string; isNew: boolean } {
  const existing = getDeviceId(req);
  if (existing) return { deviceId: existing, isNew: false };
  return { deviceId: randomUUID(), isNew: true };
}

/** Build Set-Cookie header value */
export function deviceCookieHeader(deviceId: string): string {
  return `${COOKIE_NAME}=${deviceId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}`;
}

/**
 * Deterministic pseudonym from device ID.
 * e.g. "Golden-Dragon-A3F1"
 */
export function getDisplayName(deviceId: string): string {
  const hex = deviceId.replace(/-/g, "");
  const adjIdx = parseInt(hex.slice(0, 4), 16) % ADJECTIVES.length;
  const nounIdx = parseInt(hex.slice(4, 8), 16) % NOUNS.length;
  const suffix = hex.slice(24, 28).toUpperCase();
  return `${ADJECTIVES[adjIdx]}-${NOUNS[nounIdx]}-${suffix}`;
}

/** Append the device cookie to a Response (mutates headers) */
export function attachDeviceCookie(res: Response, deviceId: string): Response {
  res.headers.append("Set-Cookie", deviceCookieHeader(deviceId));
  return res;
}
