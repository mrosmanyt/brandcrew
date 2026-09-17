import { requireUser } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/db";
import { userFoundingBadge } from "@/lib/founding-members";
import { withNativeCors } from "@/lib/auth-native";
import { siteOrigin } from "@/lib/site";

/** Shareable invite link — +1 free month stub on redemption at signup. */
export async function GET() {
  try {
    const user = await requireUser();
    const badge = await userFoundingBadge(user.id);
    let inviteCode = badge?.inviteCode;
    if (!inviteCode) {
      const row = await prisma.user.findUnique({
        where: { id: user.id },
        select: { inviteCode: true },
      });
      inviteCode = row?.inviteCode ?? null;
    }
    const origin = siteOrigin().replace(/\/$/, "");
    return withNativeCors(
      jsonOk({
        inviteCode,
        inviteUrl: inviteCode ? `${origin}/signup?ref=${inviteCode}` : null,
        foundingMember: Boolean(badge?.foundingMember),
        foundingNumber: badge?.number ?? null,
        perk: "Invite a friend — they get priority signup; you earn +1 free month (stub).",
      }),
    );
  } catch (error) {
    return jsonError(error);
  }
}
