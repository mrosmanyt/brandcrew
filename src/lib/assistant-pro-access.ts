/**
 * Single Cinem AI Assistant Pro-access helper.
 * Every Assistant-value server route that meters or commands the product
 * must call `assertAssistantProAccess` / `assertAssistantProAccessForUser`.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ClientError } from "@/lib/http";
import { isPaidPlan, normalizePlanId } from "@/lib/limits";
import { listUserWorkspaces } from "@/lib/workspace";
import {
  entitlementFromWorkspaces,
  type WorkspacePlanRow,
} from "@/lib/cinem-ai-assistant";

export const ASSISTANT_PRO_REQUIRED_ERROR = "Pro required";
export const ASSISTANT_PRO_REQUIRED_CODE = "PRO_REQUIRED";

/** WhatsApp sales contact for the desktop/web lock UI. */
export const ASSISTANT_SALES_WHATSAPP_E164 = "+923489057646";
export const ASSISTANT_SALES_WHATSAPP_URL = "https://wa.me/923489057646";

/**
 * Ship timestamp for this Pro-only change.
 * Default cutoff is 7 days later. Override with env `ASSISTANT_FREE_CUTOFF_AT`.
 */
export const ASSISTANT_PRO_ONLY_SHIPPED_AT = "2026-09-20T18:40:00.000Z";

/** Default Free sunset: 2026-09-27T18:40:00.000Z (ship + 7 days). */
export const ASSISTANT_FREE_CUTOFF_AT = "2026-09-27T18:40:00.000Z";

export const ASSISTANT_PRO_REQUIRED_BODY = {
  error: ASSISTANT_PRO_REQUIRED_ERROR,
  code: ASSISTANT_PRO_REQUIRED_CODE,
} as const;

export type AssistantProReason =
  | "founding"
  | "paid_desk"
  | "assistant_subscription"
  | "legacy_free"
  | "referral_bonus"
  | "pro_required";

export type AssistantSubscriptionInput = {
  status?: string | null;
  currentPeriodEnd?: Date | string | null;
  plan?: string | null;
} | null;

export type AssistantProAccessInput = {
  assistantFoundingMember?: boolean | null;
  plan?: string | null;
  subscription?: AssistantSubscriptionInput;
  referralBonusMonths?: number | null;
};

export type AssistantProAccess = {
  allowed: boolean;
  pro: boolean;
  foundingMember: boolean;
  paidDesk: boolean;
  activeSubscription: boolean;
  referralBonusMonths: number;
  reason: AssistantProReason;
  proRequired: boolean;
  sunsetBanner: boolean;
  cutoffAt: string;
  whatsappUrl: string;
  code?: typeof ASSISTANT_PRO_REQUIRED_CODE;
};

function parseDate(raw?: Date | string | null): Date | null {
  if (!raw) return null;
  const date = raw instanceof Date ? raw : new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function assistantFreeCutoffAt(): Date {
  const env = process.env.ASSISTANT_FREE_CUTOFF_AT?.trim();
  if (env) {
    const parsed = new Date(env);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date(ASSISTANT_FREE_CUTOFF_AT);
}

export function isAssistantFreeSunsetActive(now = new Date()): boolean {
  return now.getTime() >= assistantFreeCutoffAt().getTime();
}

export function isActiveAssistantSubscription(
  subscription?: AssistantSubscriptionInput,
  now = new Date(),
): boolean {
  if (!subscription || subscription.status !== "active") return false;
  const end = parseDate(subscription.currentPeriodEnd);
  if (!end) return true;
  return end.getTime() >= now.getTime();
}

/** Pure Pro check: founding, paid desk, or active AssistantSubscription. */
export function hasAssistantProAccess(input: AssistantProAccessInput, now = new Date()): boolean {
  if (input.assistantFoundingMember) return true;
  if (isPaidPlan(input.plan)) return true;
  return isActiveAssistantSubscription(input.subscription, now);
}

export function evaluateAssistantProAccess(
  input: AssistantProAccessInput,
  now = new Date(),
): AssistantProAccess {
  const foundingMember = Boolean(input.assistantFoundingMember);
  const paidDesk = isPaidPlan(input.plan);
  const activeSubscription = isActiveAssistantSubscription(input.subscription, now);
  const referralBonusMonths = Math.max(0, Math.floor(input.referralBonusMonths ?? 0));
  const afterCutoff = isAssistantFreeSunsetActive(now);
  const cutoffAt = assistantFreeCutoffAt().toISOString();
  const pro = foundingMember || paidDesk || activeSubscription;

  const base = {
    foundingMember,
    paidDesk,
    activeSubscription,
    referralBonusMonths,
    cutoffAt,
    whatsappUrl: ASSISTANT_SALES_WHATSAPP_URL,
  };

  if (foundingMember) {
    return {
      ...base,
      allowed: true,
      pro: true,
      reason: "founding",
      proRequired: false,
      sunsetBanner: false,
    };
  }
  if (paidDesk) {
    return {
      ...base,
      allowed: true,
      pro: true,
      reason: "paid_desk",
      proRequired: false,
      sunsetBanner: false,
    };
  }
  if (activeSubscription) {
    return {
      ...base,
      allowed: true,
      pro: true,
      reason: "assistant_subscription",
      proRequired: false,
      sunsetBanner: false,
    };
  }
  if (referralBonusMonths > 0) {
    return {
      ...base,
      allowed: true,
      pro: false,
      reason: "referral_bonus",
      proRequired: false,
      sunsetBanner: !afterCutoff,
    };
  }
  if (!afterCutoff) {
    return {
      ...base,
      allowed: true,
      pro: false,
      reason: "legacy_free",
      proRequired: false,
      sunsetBanner: true,
    };
  }
  return {
    ...base,
    allowed: false,
    pro: false,
    reason: "pro_required",
    proRequired: true,
    sunsetBanner: false,
    code: ASSISTANT_PRO_REQUIRED_CODE,
  };
}

export function assertAssistantProAccess(
  input: AssistantProAccessInput,
  now = new Date(),
): AssistantProAccess {
  const access = evaluateAssistantProAccess(input, now);
  if (!access.allowed) {
    throw new ClientError(ASSISTANT_PRO_REQUIRED_ERROR, 402, ASSISTANT_PRO_REQUIRED_CODE);
  }
  return access;
}

export async function loadAssistantProAccess(
  userId: string,
  extra: WorkspacePlanRow[] = [],
  now = new Date(),
): Promise<AssistantProAccess & { plan: ReturnType<typeof normalizePlanId>; workspaceId: string | null }> {
  const [workspaces, userRow, subscription] = await Promise.all([
    listUserWorkspaces(userId),
    prisma.user.findUnique({
      where: { id: userId },
      select: { assistantFoundingMember: true, referralBonusMonths: true },
    }),
    prisma.assistantSubscription.findUnique({
      where: { userId },
      select: { status: true, currentPeriodEnd: true, plan: true },
    }),
  ]);
  const entitlement = entitlementFromWorkspaces(
    [...workspaces.map((row) => ({ id: row.id, plan: row.plan })), ...extra],
    { assistantFoundingMember: userRow?.assistantFoundingMember },
  );
  const access = evaluateAssistantProAccess(
    {
      assistantFoundingMember: userRow?.assistantFoundingMember,
      plan: entitlement.plan,
      subscription,
      referralBonusMonths: userRow?.referralBonusMonths,
    },
    now,
  );
  return {
    ...access,
    plan: entitlement.plan,
    workspaceId: entitlement.workspaceId,
  };
}

export async function assertAssistantProAccessForUser(userId: string, extra: WorkspacePlanRow[] = []) {
  const access = await loadAssistantProAccess(userId, extra);
  if (!access.allowed) {
    throw new ClientError(ASSISTANT_PRO_REQUIRED_ERROR, 402, ASSISTANT_PRO_REQUIRED_CODE);
  }
  return access;
}

export function assistantProRequiredJson(
  extra?: Record<string, unknown>,
  init?: { headers?: HeadersInit },
) {
  return NextResponse.json(
    { ...ASSISTANT_PRO_REQUIRED_BODY, ...extra },
    { status: 402, headers: init?.headers },
  );
}
