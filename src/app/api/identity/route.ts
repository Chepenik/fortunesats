import { checkRateLimit } from "@/lib/ratelimit";
import {
  getOrCreateDeviceId,
  validateInitials,
  resolveDisplayName,
  deviceCookieHeader,
  initialsCookieHeader,
  clearInitialsCookieHeader,
} from "@/lib/device-id";
import { updateLeaderboardDisplayName } from "@/lib/leaderboard";

/**
 * POST /api/identity — Set or clear custom initials.
 *
 * Body: { initials: string }          → set initials (2-4 uppercase letters)
 * Body: { initials: "" } or { initials: null } → clear initials (revert to pseudonym)
 *
 * Creates a device cookie if the user doesn't have one yet.
 */
export async function POST(req: Request) {
  console.log("[identity] POST received");

  const limited = await checkRateLimit(req, { prefix: "identity", limit: 5, window: "1 m" });
  if (limited) return limited;

  const { deviceId, isNew } = getOrCreateDeviceId(req);
  console.log("[identity] deviceId=%s isNew=%s", deviceId.slice(0, 8), isNew);

  let body: { initials?: string | null };
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { error: { code: "invalid_body", message: "Invalid JSON body" } },
      { status: 400 },
    );
  }

  const raw = body.initials;
  console.log("[identity] raw initials=%s", raw);

  // Clear initials — revert to pseudonym
  if (!raw) {
    const displayName = resolveDisplayName(deviceId, null);
    await updateLeaderboardDisplayName(deviceId, displayName);

    const headers = new Headers({
      "Content-Type": "application/json",
    });
    headers.append("Set-Cookie", clearInitialsCookieHeader());
    if (isNew) headers.append("Set-Cookie", deviceCookieHeader(deviceId));

    console.log("[identity] cleared → %s", displayName);
    return new Response(JSON.stringify({ displayName }), { status: 200, headers });
  }

  // Validate initials
  const cleaned = validateInitials(raw);
  if (!cleaned) {
    console.log("[identity] invalid initials rejected: %s", raw);
    return Response.json(
      { error: { code: "invalid_initials", message: "Initials must be 2-4 letters (A-Z)" } },
      { status: 400 },
    );
  }

  const displayName = resolveDisplayName(deviceId, cleaned);
  await updateLeaderboardDisplayName(deviceId, displayName);

  const headers = new Headers({
    "Content-Type": "application/json",
  });
  headers.append("Set-Cookie", initialsCookieHeader(cleaned));
  if (isNew) headers.append("Set-Cookie", deviceCookieHeader(deviceId));

  console.log("[identity] saved %s → %s (isNew=%s)", cleaned, displayName, isNew);
  return new Response(
    JSON.stringify({ displayName, initials: cleaned }),
    { status: 200, headers },
  );
}
