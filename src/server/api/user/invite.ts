import { requireUser } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { userFoundingBadge } from "@/lib/founding-members";
import { ensureUserInviteCode, referralStats } from "@/lib/referral-invites";
import { withNativeCors } from "@/lib/auth-native";
import { siteOrigin } from "@/lib/site";

/** Shareable invite link. New redemptions no longer grant Assistant bonus months. */
export async function GET() {
  try {
    const user = await requireUser();
    const badge = await userFoundingBadge(user.id);
    const inviteCode = badge?.inviteCode || (await ensureUserInviteCode(user.id));
    const stats = await referralStats(user.id);
    const origin = siteOrigin().replace(/\/$/, "");
    return withNativeCors(
      jsonOk({
        inviteCode,
        inviteUrl: `${origin}/signup?ref=${inviteCode}`,
        foundingMember: Boolean(badge?.foundingMember),
        foundingNumber: badge?.number ?? null,
        referralBonusMonths: stats.referralBonusMonths,
        inviterRedemptions: stats.inviterRedemptions,
        inviterCap: stats.inviterCap,
        inviterCapReached: stats.inviterCapReached,
        redeemedAsInvitee: stats.redeemedAsInvitee,
        perk: `Share your invite link. New invites no longer add Assistant bonus months. Any bonus months you already have (${stats.referralBonusMonths}) still apply until they run out. Capped at ${stats.inviterCap} recorded invites.`,
      }),
    );
  } catch (error) {
    return jsonError(error);
  }
}
