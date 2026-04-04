import { checkRateLimit } from "@/lib/ratelimit";
import { getOrCreateDeviceId, attachDeviceCookie } from "@/lib/device-id";
import { claimGift } from "@/lib/gift";
import { getFlags, unavailableResponse } from "@/lib/flags";

export async function POST(req: Request) {
  const { giftEnabled } = getFlags();
  if (!giftEnabled) return unavailableResponse("Gift fortunes");

  const limited = await checkRateLimit(req, { prefix: "gift-claim", limit: 10, window: "1 m" });
  if (limited) return limited;

  let body: { token?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { error: { code: "invalid_body", message: "JSON body required" } },
      { status: 400 },
    );
  }

  const { token } = body;
  if (!token || typeof token !== "string") {
    return Response.json(
      { error: { code: "invalid_param", message: "token is required" } },
      { status: 400 },
    );
  }

  const { deviceId, isNew } = getOrCreateDeviceId(req);
  const result = await claimGift(token, deviceId);

  if (!result.success) {
    return Response.json(
      { error: { code: "claim_failed", message: result.error } },
      { status: result.status ?? 400 },
    );
  }

  const { gift } = result;
  const res = Response.json({
    fortune: gift.fortune,
    rarity: gift.rarity,
    claimedAt: gift.claimedAt,
  });
  if (isNew) attachDeviceCookie(res, deviceId);
  return res;
}
