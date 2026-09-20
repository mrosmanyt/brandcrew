import { getUserFromRequest, AuthError } from "@/lib/auth";
import { requireDevice, readDeviceToken } from "@/lib/device-auth";
import { DEVICE_TOKEN_PREFIX } from "@/lib/device-protocol";
import { prisma } from "@/lib/db";
import { originFromRequest } from "@/lib/billing";
import { normalizePlanId } from "@/lib/limits";
import { listUserWorkspaces } from "@/lib/workspace";
import {
  loadAssistantProAccess,
  type AssistantProAccess,
} from "@/lib/assistant-pro-access";
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

function snapshotFromAccess(input: {
  plan: ReturnType<typeof normalizePlanId>;
  used: number;
  period: string;
  upgradeUrl: string;
  workspaceId: string | null;
  access: AssistantProAccess;
}): CinemAiAssistantUsageSnapshot {
  const referralOnly = input.access.reason === "referral_bonus";
  return usageSnapshot({
    plan: input.plan,
    used: input.used,
    period: input.period,
    upgradeUrl: input.upgradeUrl,
    workspaceId: input.workspaceId,
    includedWithPlan: input.access.pro,
    foundingMember: input.access.foundingMember,
    gatePaidOnly: referralOnly && input.access.referralBonusMonths <= 0,
    referralBonusMonths: input.access.referralBonusMonths,
    pro: input.access.pro,
    proRequired: input.access.proRequired,
    sunsetBanner: input.access.sunsetBanner,
    cutoffAt: input.access.cutoffAt,
    whatsappUrl: input.access.whatsappUrl,
  });
}

function turnLimitForAccess(
  plan: ReturnType<typeof normalizePlanId>,
  access: AssistantProAccess,
) {
  if (access.proRequired) return 0;
  const referralTurns = access.referralBonusMonths * CINEM_AI_ASSISTANT_FREE_TURNS;
  if (access.reason === "referral_bonus") return referralTurns;
  if (access.reason === "legacy_free") return CINEM_AI_ASSISTANT_FREE_TURNS + referralTurns;
  return cinemAiAssistantTurnLimit(plan) + referralTurns;
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
  const access = await loadAssistantProAccess(caller.userId);
  return snapshotFromAccess({
    plan: caller.plan,
    used,
    period,
    upgradeUrl: cinemAiAssistantUpgradeUrl(originFromRequest(request)),
    workspaceId: caller.workspaceId,
    access,
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
  const access = await loadAssistantProAccess(caller.userId);
  const effectiveLimit = turnLimitForAccess(caller.plan, access);

  if (access.proRequired || current >= effectiveLimit) {
    return snapshotFromAccess({
      plan: caller.plan,
      used: current,
      period,
      upgradeUrl,
      workspaceId: caller.workspaceId,
      access,
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

  return snapshotFromAccess({
    plan: caller.plan,
    used: nextUsed,
    period,
    upgradeUrl,
    workspaceId: caller.workspaceId,
    access,
  });
}
