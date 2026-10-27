import { planBudget } from "@/lib/billing";
import {
  assistantSubscriptionPeriodEnd,
  type AssistantBillingPlanId,
} from "@/lib/cinem-ai-assistant-billing";
import {
  extractWhopResource,
  isAssistantProductCheckout,
  isMembershipDeactivatedEvent,
  isPaidUnlockEvent,
  isSupportCheckout,
  parseWhopEnvelope,
  resolveAssistantPlanFromWhop,
  resolvePaidPlanFromWhop,
  shouldDowngradeToDemo,
} from "@/lib/billing-events";
import { prisma } from "@/lib/db";
import { applyPaidSupport } from "@/lib/support-fulfill";

export type BillingFulfillResult = {
  outcome: "upgraded" | "downgraded" | "ignored" | "duplicate" | "supported";
  workspaceId?: string;
  plan?: string;
};

async function alreadyProcessed(id: string, externalId: string | null) {
  const byWebhook = await prisma.processedWebhook.findUnique({ where: { id } });
  if (byWebhook) return true;
  if (!externalId) return false;
  const byExternal = await prisma.processedWebhook.findFirst({
    where: { externalId },
  });
  return Boolean(byExternal);
}

async function markProcessed(input: {
  id: string;
  eventType: string;
  externalId: string | null;
}) {
  try {
    await prisma.processedWebhook.create({
      data: {
        id: input.id,
        eventType: input.eventType,
        externalId: input.externalId,
      },
    });
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return;
    }
    throw error;
  }
}

async function applyAssistantSubscription(input: {
  userId: string;
  plan: AssistantBillingPlanId;
  membershipId: string | null;
}) {
  const periodEnd = assistantSubscriptionPeriodEnd(input.plan);
  return prisma.assistantSubscription.upsert({
    where: { userId: input.userId },
    create: {
      userId: input.userId,
      plan: input.plan,
      status: "active",
      currentPeriodEnd: periodEnd,
      whopMembershipId: input.membershipId,
    },
    update: {
      plan: input.plan,
      status: "active",
      currentPeriodEnd: periodEnd,
      ...(input.membershipId ? { whopMembershipId: input.membershipId } : {}),
    },
  });
}

async function applyPaidPlan(input: {
  workspaceId: string;
  plan: "starter" | "pro" | "ultra";
  membershipId: string | null;
}) {
  return prisma.workspace.update({
    where: { id: input.workspaceId },
    data: {
      plan: input.plan,
      tokenBudget: planBudget(input.plan),
      ...(input.membershipId ? { whopMembershipId: input.membershipId } : {}),
    },
  });
}

export async function fulfillWhopEvent(input: {
  webhookId: string;
  body: unknown;
}): Promise<BillingFulfillResult> {
  const parsed = parseWhopEnvelope(input.body);
  const type = parsed.type;
  const resource = extractWhopResource(parsed.data);
  const dedupeId = input.webhookId || parsed.eventId;
  if (!dedupeId) {
    return { outcome: "ignored" };
  }

  const externalId = isPaidUnlockEvent(type)
    ? resource.paymentId || resource.membershipId
    : resource.membershipId || resource.id;

  if (await alreadyProcessed(dedupeId, externalId)) {
    return { outcome: "duplicate" };
  }

  if (isSupportCheckout(resource)) {
    if (!isPaidUnlockEvent(type)) {
      await markProcessed({ id: dedupeId, eventType: type || "unknown", externalId });
      return { outcome: "ignored", workspaceId: resource.workspaceId || undefined };
    }
    const paid = await applyPaidSupport({
      amountCents: resource.amountCents,
      userId: resource.userId,
      workspaceId: resource.workspaceId,
      email: resource.email,
      paymentId: resource.paymentId || resource.membershipId,
      provider: "whop",
    });
    await markProcessed({ id: dedupeId, eventType: type, externalId });
    return {
      outcome: paid.outcome,
      workspaceId: resource.workspaceId || undefined,
    };
  }

  if (isPaidUnlockEvent(type) && isAssistantProductCheckout(resource.metadata)) {
    const assistantPlan = resolveAssistantPlanFromWhop({
      metadata: resource.metadata,
      planId: resource.planId,
    });
    const userId = resource.userId;
    if (!assistantPlan || !userId) {
      await markProcessed({ id: dedupeId, eventType: type || "unknown", externalId });
      return { outcome: "ignored" };
    }
    await applyAssistantSubscription({
      userId,
      plan: assistantPlan,
      membershipId: resource.membershipId,
    });
    await markProcessed({ id: dedupeId, eventType: type, externalId });
    return { outcome: "upgraded", plan: assistantPlan };
  }

  if (isPaidUnlockEvent(type)) {
    const workspaceId = resource.workspaceId;
    const plan = resolvePaidPlanFromWhop({
      metadata: resource.metadata,
      planId: resource.planId,
    });
    if (!workspaceId || !plan) {
      await markProcessed({ id: dedupeId, eventType: type || "unknown", externalId });
      return { outcome: "ignored" };
    }
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true },
    });
    if (!workspace) {
      await markProcessed({ id: dedupeId, eventType: type, externalId });
      return { outcome: "ignored", workspaceId };
    }
    await applyPaidPlan({
      workspaceId,
      plan,
      membershipId: resource.membershipId,
    });
    await markProcessed({ id: dedupeId, eventType: type, externalId });
    return { outcome: "upgraded", workspaceId, plan };
  }

  if (isMembershipDeactivatedEvent(type) && isAssistantProductCheckout(resource.metadata)) {
    const userId = resource.userId;
    if (!userId) {
      await markProcessed({ id: dedupeId, eventType: type, externalId });
      return { outcome: "ignored" };
    }
    const existing = await prisma.assistantSubscription.findUnique({
      where: { userId },
      select: { whopMembershipId: true },
    });
    const membershipMatches = Boolean(
      resource.membershipId && existing?.whopMembershipId === resource.membershipId,
    );
    if (membershipMatches || !resource.membershipId) {
      await prisma.assistantSubscription.updateMany({
        where: { userId },
        data: { status: "cancelled", whopMembershipId: null },
      });
      await markProcessed({ id: dedupeId, eventType: type, externalId });
      return { outcome: "downgraded", plan: "cancelled" };
    }
    await markProcessed({ id: dedupeId, eventType: type, externalId });
    return { outcome: "ignored" };
  }

  if (isMembershipDeactivatedEvent(type)) {
    const byMembership = resource.membershipId
      ? await prisma.workspace.findFirst({
          where: { whopMembershipId: resource.membershipId },
          select: { id: true, plan: true, whopMembershipId: true },
        })
      : null;
    const byMetadata = resource.workspaceId
      ? await prisma.workspace.findUnique({
          where: { id: resource.workspaceId },
          select: { id: true, plan: true, whopMembershipId: true },
        })
      : null;
    const workspace = byMembership || byMetadata;
    if (!workspace) {
      await markProcessed({ id: dedupeId, eventType: type, externalId });
      return { outcome: "ignored" };
    }

    const deactivatedPlan = resolvePaidPlanFromWhop({
      metadata: resource.metadata,
      planId: resource.planId,
    });
    const membershipMatches = Boolean(
      resource.membershipId && workspace.whopMembershipId === resource.membershipId,
    );
    if (
      !shouldDowngradeToDemo({
        currentPlan: workspace.plan,
        deactivatedPlan,
        membershipMatches,
      })
    ) {
      await markProcessed({ id: dedupeId, eventType: type, externalId });
      return { outcome: "ignored", workspaceId: workspace.id, plan: workspace.plan };
    }

    await prisma.workspace.update({
      where: { id: workspace.id },
      data: {
        plan: "demo",
        tokenBudget: planBudget("demo"),
        whopMembershipId: null,
      },
    });
    await markProcessed({ id: dedupeId, eventType: type, externalId });
    return {
      outcome: "downgraded",
      workspaceId: workspace.id,
      plan: "demo",
    };
  }

  await markProcessed({
    id: dedupeId,
    eventType: type || "unknown",
    externalId,
  });
  return { outcome: "ignored" };
}
