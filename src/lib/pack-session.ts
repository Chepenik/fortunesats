/**
 * Pack session management via HttpOnly cookie.
 *
 * Moves the pack secret out of localStorage (XSS-vulnerable) into
 * an HttpOnly SameSite=Lax cookie that JavaScript cannot read.
 *
 * Cookie name: fsp (fortune sats pack)
 * Cookie value: {orderId}|{secret}
 *
 * Backward compatibility: pack endpoints accept credentials from
 * the cookie first, falling back to the request body for packs
 * created before this migration.
 */

const COOKIE_NAME = "fsp";
const COOKIE_MAX_AGE = 90 * 24 * 60 * 60; // 90 days (matches order Redis TTL)

export interface PackCredentials {
  orderId: string;
  secret: string;
}

/**
 * Parse pack credentials from the HttpOnly cookie.
 * Returns null if the cookie is missing or malformed.
 */
export function getPackFromCookie(req: Request): PackCredentials | null {
  const cookie = req.headers.get("cookie") ?? "";
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
  if (!match) return null;

  const decoded = decodeURIComponent(match[1]);
  const sep = decoded.indexOf("|");
  if (sep < 1) return null;

  const orderId = decoded.slice(0, sep);
  const secret = decoded.slice(sep + 1);
  if (!orderId || !secret) return null;

  return { orderId, secret };
}

/**
 * Resolve pack credentials from cookie (preferred) or request body (fallback).
 * If orderId is in the body and matches the cookie, uses cookie secret.
 * If no cookie exists, uses body orderId + secret (backward compat).
 */
export function resolvePackCredentials(
  req: Request,
  body: { orderId?: string; secret?: string },
): PackCredentials | null {
  const fromCookie = getPackFromCookie(req);

  if (fromCookie) {
    // If body has an orderId, make sure it matches the cookie
    if (body.orderId && body.orderId !== fromCookie.orderId) {
      // Mismatch — prefer body orderId but require body secret (different pack)
      if (body.secret) return { orderId: body.orderId, secret: body.secret };
      return null;
    }
    return fromCookie;
  }

  // No cookie — fall back to body (backward compat for pre-migration packs)
  if (body.orderId && body.secret) {
    return { orderId: body.orderId, secret: body.secret };
  }

  return null;
}

/**
 * Build Set-Cookie header for a new pack session.
 * Call this on order creation.
 */
export function packCookieHeader(orderId: string, secret: string): string {
  const value = encodeURIComponent(`${orderId}|${secret}`);
  return `${COOKIE_NAME}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}`;
}

/**
 * Build Set-Cookie header that clears the pack session.
 * Call this when a pack is fully depleted.
 */
export function clearPackCookieHeader(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

/**
 * Append the pack session cookie to a Response.
 */
export function attachPackCookie(
  res: Response,
  orderId: string,
  secret: string,
): Response {
  res.headers.append("Set-Cookie", packCookieHeader(orderId, secret));
  return res;
}

/**
 * Append the clear-pack cookie to a Response.
 */
export function attachClearPackCookie(res: Response): Response {
  res.headers.append("Set-Cookie", clearPackCookieHeader());
  return res;
}
