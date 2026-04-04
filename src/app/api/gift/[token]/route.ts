import { getGift } from "@/lib/gift";
import { getFlags, unavailableResponse } from "@/lib/flags";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { giftEnabled } = getFlags();
  if (!giftEnabled) return unavailableResponse("Gift fortunes");

  const { token } = await params;
  const gift = await getGift(token);

  if (!gift) {
    return Response.json(
      { error: { code: "not_found", message: "Gift not found or expired" } },
      { status: 404 },
    );
  }

  // Never expose fortune text in status check — only the claim endpoint reveals it
  return Response.json({
    status: gift.status,
    rarity: gift.rarity,
    createdAt: gift.createdAt,
    expiresAt: gift.expiresAt,
    claimedAt: gift.claimedAt ?? null,
  });
}
