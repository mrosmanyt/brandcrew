import { getUserFromRequest, AuthError } from "@/lib/auth";
import { requireDevice, readDeviceToken } from "@/lib/device-auth";
import { DEVICE_TOKEN_PREFIX } from "@/lib/device-protocol";
import { prisma } from "@/lib/db";
import { originFromRequest } from "@/lib/billing";
import { normalizePlanId } from "@/lib/limits";
import { listUserWorkspaces } from "@/lib/workspace";
import {
  CINEM_AI_ASSISTANT_PRODUCT,
  CINEM_AI_ASSISTANT_FREE_TURNS,
  cinemAiAssistantPeriodUtc,
  cinemAiAssistantTurnLimit,
  cinemAiAssistantUpgradeUrl,
  clampUsageIncrement,
  entitlementFromWorkspaces,
  usageSnapshot,
  type CinemAiAssistantUsageSnapshot,
  type WorkspacePlanRow,
} from "@/lib/cinem-ai-assistant";

export type AssistantCaller = {
  userId: string;
  plan: ReturnType<typeof normalizePlanId>;
  workspaceId: string | null;
};

/** Best paid desk on this CINEM Pro account — same plan the website sold. */
export async function planForUser(userId: string, extra: WorkspacePlanRow[] = []) {
  const [workspaces, userRow] = await Promise.all([
    listUserWorkspaces(userId),
    prisma.user.findUnique({
      where: { id: userId },
      select: { assistantFoundingMember: true, referralBonusMonths: true },
    }),
  ]);
  return entitlementFromWorkspaces(
    [...workspaces.map((row) => ({ id: row.id, plan: row.plan })), ...extra],
    { assistantFoundingMember: userRow?.assistantFoundingMember },
  );
}

async function referralBonusMonths(userId: string) {
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { referralBonusMonths: true },
  });
  return row?.referralBonusMonths ?? 0;
}

async function ownerUserId(workspaceId: string) {
  const owner = await prisma.workspaceMember.findFirst({
    where: { workspaceId, role: "owner" },
    select: { userId: true },
    orderBy: { id: "asc" },
  });
  return owner?.userId ?? null;
}

/**
 * Same auth as desktop cloud shell: session cookie or Bearer access JWT.
 * Device tokens (`cinem_dev_…`) count against the linked account (or desk owner).
 */
export async function requireCinemAssistantCaller(request: Request): Promise<AssistantCaller> {
  const user = await getUserFromRequest(request);
  if (user) {
    const { plan, workspaceId } = await planForUser(user.id);
    return { userId: user.id, plan, workspaceId };
  }

  const token = readDeviceToken(request);
  if (token.startsWith(DEVICE_TOKEN_PREFIX)) {
    const device = await requireDevice(request);
    const row = await prisma.localDevice.findUnique({
      where: { id: device.id },
      select: { linkedUserId: true },
    });
    const userId = row?.linkedUserId || (await ownerUserId(device.workspaceId));
    if (!userId) {
      throw new AuthError("Sign in to use Cinem AI Assistant.");
    }
    const workspace = await prisma.workspace.findUnique({
      where: { id: device.workspaceId },
      select: { id: true, plan: true },
    });
    const entitlement = await planForUser(userId, workspace ? [workspace] : []);
    return {
      userId,
      plan: entitlement.plan,
      workspaceId: entitlement.workspaceId ?? device.workspaceId,
    };
  }

  throw new AuthError("Sign in to continue.");
}

async function readUsed(userId: string, period: string) {
  const row = await prisma.productUsage.findUnique({
    where: {
      userId_product_period: {
        userId,
        product: CINEM_AI_ASSISTANT_PRODUCT,
        period,
      },
    },
    select: { used: true },
  });
  return row?.used ?? 0;
}

export async function getCinemAssistantUsage(
  request: Request,
  caller: AssistantCaller,
): Promise<CinemAiAssistantUsageSnapshot> {
  const period = cinemAiAssistantPeriodUtc();
  const used = await readUsed(caller.userId, period);
  const userRow = await prisma.user.findUnique({
    where: { id: caller.userId },
    select: { assistantFoundingMember: true, assistantRequiresPaid: true, referralBonusMonths: true },
  });
  const entitlement = await planForUser(caller.userId);
  return usageSnapshot({
    plan: caller.plan,
    used,
    period,
    upgradeUrl: cinemAiAssistantUpgradeUrl(originFromRequest(request)),
    workspaceId: caller.workspaceId,
    includedWithPlan: entitlement.includedWithPlan,
    foundingMember: entitlement.foundingMember,
    gatePaidOnly: Boolean(userRow?.assistantRequiresPaid && !entitlement.includedWithPlan),
    referralBonusMonths: userRow?.referralBonusMonths ?? 0,
  });
}

export async function incrementCinemAssistantUsage(
  request: Request,
  caller: AssistantCaller,
  turnsRaw?: unknown,
): Promise<CinemAiAssistantUsageSnapshot> {
  const period = cinemAiAssistantPeriodUtc();
  const turns = clampUsageIncrement(turnsRaw);
  const current = await readUsed(caller.userId, period);
  const upgradeUrl = cinemAiAssistantUpgradeUrl(originFromRequest(request));
  const userRow = await prisma.user.findUnique({
    where: { id: caller.userId },
    select: { assistantFoundingMember: true, assistantRequiresPaid: true, referralBonusMonths: true },
  });
  const entitlement = await planForUser(caller.userId);
  const gatePaidOnly = Boolean(userRow?.assistantRequiresPaid && !entitlement.includedWithPlan);
  const referralBonus = userRow?.referralBonusMonths ?? 0;
  const effectiveLimit =
    gatePaidOnly && referralBonus <= 0
      ? 0
      : cinemAiAssistantTurnLimit(caller.plan) + referralBonus * CINEM_AI_ASSISTANT_FREE_TURNS;

  if ((gatePaidOnly && referralBonus <= 0) || current >= effectiveLimit) {
    return usageSnapshot({
      plan: caller.plan,
      used: current,
      period,
      upgradeUrl,
      workspaceId: caller.workspaceId,
      includedWithPlan: entitlement.includedWithPlan,
      foundingMember: entitlement.foundingMember,
      gatePaidOnly,
      referralBonusMonths: referralBonus,
    });
  }

  const nextUsed = Math.min(effectiveLimit, current + turns);
  await prisma.productUsage.upsert({
    where: {
      userId_product_period: {
        userId: caller.userId,
        product: CINEM_AI_ASSISTANT_PRODUCT,
        period,
      },
    },
    create: {
      userId: caller.userId,
      product: CINEM_AI_ASSISTANT_PRODUCT,
      period,
      used: nextUsed,
    },
    update: { used: nextUsed },
  });

  return usageSnapshot({
    plan: caller.plan,
    used: nextUsed,
    period,
    upgradeUrl,
    workspaceId: caller.workspaceId,
    includedWithPlan: entitlement.includedWithPlan,
    foundingMember: entitlement.foundingMember,
    gatePaidOnly,
    referralBonusMonths: referralBonus,
  });
}
