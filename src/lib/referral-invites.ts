/**
 * Viral invite "+1 free month" — durable assistant entitlement, not Whop coupons.
 * One redemption per invitee; inviter capped to prevent abuse.
 */
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { CINEM_AI_ASSISTANT_FREE_TURNS } from "@/lib/cinem-ai-assistant";

export const REFERRAL_BONUS_MONTHS_DEFAULT = 1;
export const REFERRAL_INVITER_CAP = 50;
export const REFERRAL_TURNS_PER_MONTH = CINEM_AI_ASSISTANT_FREE_TURNS;

export function referralBonusTurns(months: number) {
  return Math.max(0, Math.floor(months)) * REFERRAL_TURNS_PER_MONTH;
}

export async function ensureUserInviteCode(userId: string) {
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { inviteCode: true },
  });
  if (row?.inviteCode) return row.inviteCode;
  for (let i = 0; i < 6; i++) {
    const candidate = randomBytes(5).toString("hex");
    const taken = await prisma.user.findUnique({ where: { inviteCode: candidate } });
    if (!taken) {
      await prisma.user.update({ where: { id: userId }, data: { inviteCode: candidate } });
      return candidate;
    }
  }
  const fallback = randomBytes(6).toString("hex");
  await prisma.user.update({ where: { id: userId }, data: { inviteCode: fallback } });
  return fallback;
}

export async function referralStats(userId: string) {
  const [user, redeemed, sent] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { referralBonusMonths: true, inviteCode: true },
    }),
    prisma.inviteRedemption.findUnique({
      where: { inviteeId: userId },
      select: { inviterId: true, createdAt: true },
    }),
    prisma.inviteRedemption.count({ where: { inviterId: userId } }),
  ]);
  return {
    inviteCode: user?.inviteCode ?? null,
    referralBonusMonths: user?.referralBonusMonths ?? 0,
    redeemedAsInvitee: Boolean(redeemed),
    inviterRedemptions: sent,
    inviterCap: REFERRAL_INVITER_CAP,
    inviterCapReached: sent >= REFERRAL_INVITER_CAP,
  };
}

/** Grant +1 month to inviter and invitee when a valid ref signs up. Idempotent per invitee. */
export async function redeemReferralOnSignup(userId: string, invitedByCode?: string | null) {
  const code = invitedByCode?.trim().toLowerCase();
  if (!code) return { redeemed: false as const, reason: "no_code" as const };

  const existing = await prisma.inviteRedemption.findUnique({
    where: { inviteeId: userId },
  });
  if (existing) {
    return { redeemed: true as const, duplicate: true as const };
  }

  const inviter = await prisma.user.findFirst({
    where: { inviteCode: code },
    select: { id: true, inviteCode: true },
  });
  if (!inviter) return { redeemed: false as const, reason: "invalid_code" as const };
  if (inviter.id === userId) return { redeemed: false as const, reason: "self_referral" as const };

  const inviterCount = await prisma.inviteRedemption.count({
    where: { inviterId: inviter.id },
  });
  if (inviterCount >= REFERRAL_INVITER_CAP) {
    return { redeemed: false as const, reason: "inviter_cap" as const };
  }

  await prisma.$transaction(async (tx) => {
    await tx.inviteRedemption.create({
      data: {
        inviteCode: code,
        inviterId: inviter.id,
        inviteeId: userId,
        inviterBonusMonths: REFERRAL_BONUS_MONTHS_DEFAULT,
        inviteeBonusMonths: REFERRAL_BONUS_MONTHS_DEFAULT,
      },
    });
    await tx.user.update({
      where: { id: inviter.id },
      data: { referralBonusMonths: { increment: REFERRAL_BONUS_MONTHS_DEFAULT } },
    });
    await tx.user.update({
      where: { id: userId },
      data: {
        invitedByUserId: inviter.id,
        referralBonusMonths: { increment: REFERRAL_BONUS_MONTHS_DEFAULT },
      },
    });
  });

  return {
    redeemed: true as const,
    inviterId: inviter.id,
    inviterBonusMonths: REFERRAL_BONUS_MONTHS_DEFAULT,
    inviteeBonusMonths: REFERRAL_BONUS_MONTHS_DEFAULT,
  };
}

export function hashCompanionToken(raw: string) {
  return createHash("sha256").update(raw).digest("hex");
}
