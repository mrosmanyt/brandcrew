import { requireUser } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { userFoundingBadge } from "@/lib/founding-members";
import {
  ensureUserInviteCode,
  referralStats,
  REFERRAL_BONUS_MONTHS_DEFAULT,
  REFERRAL_TURNS_PER_MONTH,
} from "@/lib/referral-invites";
import { withNativeCors } from "@/lib/auth-native";
import { siteOrigin } from "@/lib/site";

/** Shareable invite link — +1 free month on redemption at signup. */
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
        perk: `Invite a friend — you both get +${REFERRAL_BONUS_MONTHS_DEFAULT} free month (+${REFERRAL_TURNS_PER_MONTH} assistant turns/month each). One redemption per friend; capped at ${stats.inviterCap} invites.`,
      }),
    );
  } catch (error) {
    return jsonError(error);
  }
}
