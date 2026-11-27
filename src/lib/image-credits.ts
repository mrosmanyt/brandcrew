/**
 * Package 3 — free daily image credits + referral image credits.
 *
 * This is NOT a parallel credits system. Credits stay the house unit
 * (credits wrap plan token budgets 1:1, see src/lib/credits.ts) and every
 * charge still flows through the shared usage pipeline (`recordUsage` /
 * UsageEvent rows). What this module adds is two extra funding sources
 * that the image pipeline tries BEFORE the workspace plan budget:
 *
 *   1. Daily free allowance — FREE_DAILY_IMAGE_ALLOWANCE images per user
 *      per UTC day, tracked in DailyFreeImageUse. Charged as a UsageEvent
 *      with tokens = 0 (agentRole "image-gen-daily-free") so the usage
 *      history stays complete without touching the plan budget.
 *   2. Bonus image credits — User.bonusImageCredits, earned from
 *      referrals. Charged as a UsageEvent with tokens = 0 (agentRole
 *      "image-gen-bonus") plus an atomic decrement of the balance.
 *   3. Plan budget — the pre-Package-3 behaviour, unchanged
 *      (agentRole "image-gen", tokens = IMAGE_GEN_CREDIT_COST).
 *
 * Referral grants: when a user who signed up with an invite code creates
 * their first image, BOTH sides earn REFERRAL_IMAGE_CREDIT_GRANT credits.
 * The grant hangs off the existing InviteRedemption row (one redemption
 * per invitee, self-referral already blocked at signup), is idempotent,
 * and the inviter side is capped at REFERRAL_IMAGE_CREDIT_INVITER_CAP
 * granted referrals so the perk cannot be farmed at scale. Unlocking on
 * the first real image — instead of raw signup — is the anti-abuse gate:
 * throwaway accounts that never use the product earn nothing.
 */
import { prisma } from "@/lib/db";
import { IMAGE_GEN_CREDIT_COST } from "@/lib/image-generation-pure";
import { recordUsage } from "@/lib/usage";

/** Free images every signed-in user gets each UTC day. */
export const FREE_DAILY_IMAGE_ALLOWANCE = 3;

/** Credits each side earns when a referred user creates their first image. */
export const REFERRAL_IMAGE_CREDIT_GRANT = 5 * IMAGE_GEN_CREDIT_COST;

/** Max referrals one inviter can earn image credits from. */
export const REFERRAL_IMAGE_CREDIT_INVITER_CAP = 20;

export type ImageFundingSource = "daily-free" | "bonus-credits" | "plan";

export type ImageCreditsSnapshot = {
  /** Free images included every day. */
  dailyFreeLimit: number;
  dailyFreeUsed: number;
  dailyFreeLeft: number;
  /** Spendable referral-earned credits (raw credit units). */
  bonusCredits: number;
  /** Whole images the bonus balance currently covers. */
  bonusImages: number;
  /** Images each side earns per unlocked referral. */
  referralGrantImages: number;
  /** Total image credits this user has earned from referrals so far. */
  referralEarnedCredits: number;
  /** Referrals (as inviter) whose image credits have been granted. */
  referralGrantedInvites: number;
  referralInviterCap: number;
  referralCapReached: boolean;
  /** True when this user was invited and the credits unlock at their first image. */
  referralPendingUnlock: boolean;
};

/** UTC day key (YYYY-MM-DD) — the daily allowance resets at UTC midnight. */
export function imageCreditsDayKey(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

async function dailyFreeUsed(userId: string, day: string): Promise<number> {
  const row = await prisma.dailyFreeImageUse.findUnique({
    where: { userId_day: { userId, day } },
    select: { count: true },
  });
  return row?.count ?? 0;
}

export async function getImageCreditsSnapshot(
  userId: string,
): Promise<ImageCreditsSnapshot> {
  const day = imageCreditsDayKey();
  const [used, user, asInviter, asInvitee] = await Promise.all([
    dailyFreeUsed(userId, day),
    prisma.user.findUnique({
      where: { id: userId },
      select: { bonusImageCredits: true },
    }),
    prisma.inviteRedemption.aggregate({
      where: { inviterId: userId, inviteeImageCredits: { gt: 0 } },
      _sum: { inviterImageCredits: true },
      _count: true,
    }),
    prisma.inviteRedemption.findUnique({
      where: { inviteeId: userId },
      select: { inviteeImageCredits: true },
    }),
  ]);
  const bonusCredits = Math.max(0, user?.bonusImageCredits ?? 0);
  const earnedCredits =
    (asInviter._sum.inviterImageCredits ?? 0) + (asInvitee?.inviteeImageCredits ?? 0);
  const grantedInvites = asInviter._count ?? 0;
  return {
    dailyFreeLimit: FREE_DAILY_IMAGE_ALLOWANCE,
    dailyFreeUsed: used,
    dailyFreeLeft: Math.max(0, FREE_DAILY_IMAGE_ALLOWANCE - used),
    bonusCredits,
    bonusImages: Math.floor(bonusCredits / IMAGE_GEN_CREDIT_COST),
    referralGrantImages: Math.floor(REFERRAL_IMAGE_CREDIT_GRANT / IMAGE_GEN_CREDIT_COST),
    referralEarnedCredits: earnedCredits,
    referralGrantedInvites: grantedInvites,
    referralInviterCap: REFERRAL_IMAGE_CREDIT_INVITER_CAP,
    referralCapReached: grantedInvites >= REFERRAL_IMAGE_CREDIT_INVITER_CAP,
    referralPendingUnlock: Boolean(asInvitee) && (asInvitee?.inviteeImageCredits ?? 0) === 0,
  };
}

/**
 * Advisory funding source for the pre-generation budget gate. The charge
 * itself (chargeImageGeneration) re-checks atomically, so a race between
 * the gate and the charge can only move a generation to a later funding
 * source — never double-charge or lose one.
 */
export async function resolveImageFunding(
  userId: string,
): Promise<ImageFundingSource> {
  const day = imageCreditsDayKey();
  const [used, user] = await Promise.all([
    dailyFreeUsed(userId, day),
    prisma.user.findUnique({
      where: { id: userId },
      select: { bonusImageCredits: true },
    }),
  ]);
  if (used < FREE_DAILY_IMAGE_ALLOWANCE) return "daily-free";
  if ((user?.bonusImageCredits ?? 0) >= IMAGE_GEN_CREDIT_COST) {
    return "bonus-credits";
  }
  return "plan";
}

async function auditEvent(
  workspaceId: string | null,
  model: string,
  agentRole: string,
  tokens: number,
) {
  if (!workspaceId) return;
  try {
    await recordUsage({ workspaceId, tokens, model, agentRole });
  } catch {
    /* metering is best-effort after a successful generation */
  }
}

/**
 * Charge one successful image generation to the first funding source that
 * covers it: daily free allowance → bonus credits → plan budget. Claims
 * are atomic (guarded increments/decrements), so concurrent generations
 * cannot overspend a source. Returns the source that paid.
 */
export async function chargeImageGeneration(input: {
  userId: string;
  workspaceId: string | null;
  model: string;
}): Promise<ImageFundingSource> {
  const day = imageCreditsDayKey();

  // 1) Daily free allowance — claim a slot only if one is left.
  await prisma.dailyFreeImageUse.upsert({
    where: { userId_day: { userId: input.userId, day } },
    create: { userId: input.userId, day, count: 0 },
    update: {},
  });
  const claim = await prisma.dailyFreeImageUse.updateMany({
    where: {
      userId: input.userId,
      day,
      count: { lt: FREE_DAILY_IMAGE_ALLOWANCE },
    },
    data: { count: { increment: 1 } },
  });
  if (claim.count === 1) {
    await auditEvent(input.workspaceId, input.model, "image-gen-daily-free", 0);
    return "daily-free";
  }

  // 2) Bonus image credits — spend only if the balance covers a full image.
  const spend = await prisma.user.updateMany({
    where: {
      id: input.userId,
      bonusImageCredits: { gte: IMAGE_GEN_CREDIT_COST },
    },
    data: { bonusImageCredits: { decrement: IMAGE_GEN_CREDIT_COST } },
  });
  if (spend.count === 1) {
    await auditEvent(input.workspaceId, input.model, "image-gen-bonus", 0);
    return "bonus-credits";
  }

  // 3) Plan budget — the original charge, unchanged.
  if (input.workspaceId) {
    await recordUsage({
      workspaceId: input.workspaceId,
      tokens: IMAGE_GEN_CREDIT_COST,
      model: input.model,
      agentRole: "image-gen",
    });
  }
  return "plan";
}

/**
 * Grant referral image credits to both sides of an invite redemption.
 * Called after the invitee's image generations; only the FIRST one
 * unlocks the grant (the redemption row flips from 0 to the grant amount
 * exactly once). Returns true when this call made the grant.
 */
export async function maybeGrantReferralImageCredits(
  inviteeId: string,
): Promise<boolean> {
  const redemption = await prisma.inviteRedemption.findUnique({
    where: { inviteeId },
    select: { id: true, inviterId: true, inviteeImageCredits: true },
  });
  if (!redemption || redemption.inviteeImageCredits > 0) return false;

  const grantedForInviter = await prisma.inviteRedemption.count({
    where: { inviterId: redemption.inviterId, inviteeImageCredits: { gt: 0 } },
  });
  if (grantedForInviter >= REFERRAL_IMAGE_CREDIT_INVITER_CAP) return false;

  // The guarded updateMany is the idempotency gate: it flips the row from
  // 0 to the grant amount exactly once, so only the caller that wins it
  // pays both balances (in one transaction).
  const marked = await prisma.inviteRedemption.updateMany({
    where: { id: redemption.id, inviteeImageCredits: 0 },
    data: {
      inviterImageCredits: REFERRAL_IMAGE_CREDIT_GRANT,
      inviteeImageCredits: REFERRAL_IMAGE_CREDIT_GRANT,
    },
  });
  if (marked.count !== 1) return false;
  await prisma.$transaction([
    prisma.user.update({
      where: { id: redemption.inviterId },
      data: { bonusImageCredits: { increment: REFERRAL_IMAGE_CREDIT_GRANT } },
    }),
    prisma.user.update({
      where: { id: inviteeId },
      data: { bonusImageCredits: { increment: REFERRAL_IMAGE_CREDIT_GRANT } },
    }),
  ]);
  return true;
}
