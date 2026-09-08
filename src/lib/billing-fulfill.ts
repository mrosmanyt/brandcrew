import { planBudget } from "@/lib/billing";
import {
  extractWhopResource,
  isMembershipDeactivatedEvent,
  isPaidUnlockEvent,
  parseWhopEnvelope,
  resolvePaidPlanFromWhop,
  shouldDowngradeToDemo,
} from "@/lib/billing-events";
import { prisma } from "@/lib/db";

export type BillingFulfillResult = {
  outcome: "upgraded" | "downgraded" | "ignored" | "duplicate";
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
