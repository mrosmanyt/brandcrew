import { ForbiddenError, requireUser, type SessionUser } from "@/lib/auth";
import { planBudget } from "@/lib/billing";
import { prisma } from "@/lib/db";
import { isPaidPlan, normalizePlanId } from "@/lib/limits";
import type { PlanId } from "@/lib/constants";
import { PLANS } from "@/lib/constants";
import { ClientError } from "@/lib/http";
import { describeProviderModel } from "@/lib/model-catalog";

export const DEFAULT_ADMIN_EMAIL = "cinemtech@gmail.com";

export function parseAdminEmails(raw?: string | null): string[] {
  const extras = (raw ?? "")
    .split(",")
    .map((row) => row.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set([DEFAULT_ADMIN_EMAIL, ...extras])];
}

export function adminEmails(): string[] {
  return parseAdminEmails(process.env.ADMIN_EMAILS);
}

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return adminEmails().includes(email.trim().toLowerCase());
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (!isAdminEmail(user.email)) {
    throw new ForbiddenError("Admin access only.");
  }
  return user;
}

function asPlanId(plan?: string | null): PlanId {
  return normalizePlanId(plan);
}

export type AdminWorkspaceRow = {
  id: string;
  name: string;
  slug: string;
  plan: PlanId;
  paid: boolean;
  tokenUsed: number;
  tokenBudget: number;
  createdAt: string;
  ownerEmail: string | null;
  ownerName: string | null;
};

export type AdminSignupRow = {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  workspaces: { id: string; name: string; plan: PlanId }[];
};

export type AdminAuditRow = {
  id: string;
  actorEmail: string;
  action: string;
  targetId: string;
  meta: Record<string, unknown>;
  createdAt: string;
  displayName?: string;
  providerModelId?: string;
};

export type AdminDashboard = {
  users: { total: number };
  workspaces: {
    total: number;
    byPlan: Record<PlanId, number>;
    paid: number;
    free: number;
  };
  jobs: {
    running: number;
    needsYou: number;
    failedLast24h: number;
  };
  usage: {
    tokensUsedThisCycle: number;
    tokenBudgetTotal: number;
    usageEventTokens: number;
  };
  recentSignups: AdminSignupRow[];
  workspacesList: AdminWorkspaceRow[];
  audit: AdminAuditRow[];
  search: AdminSignupRow[] | null;
};

function serializeWorkspaceRow(row: {
  id: string;
  name: string;
  slug: string;
  plan: string;
  tokenUsed: number;
  tokenBudget: number;
  createdAt: Date;
  members: {
    role: string;
    user: { email: string; name: string };
  }[];
}): AdminWorkspaceRow {
  const owner =
    row.members.find((member) => member.role === "owner") ?? row.members[0];
  const plan = asPlanId(row.plan);
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    plan,
    paid: isPaidPlan(plan),
    tokenUsed: row.tokenUsed,
    tokenBudget: row.tokenBudget,
    createdAt: row.createdAt.toISOString(),
    ownerEmail: owner?.user.email ?? null,
    ownerName: owner?.user.name ?? null,
  };
}

function serializeSignup(row: {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
  memberships: { workspace: { id: string; name: string; plan: string } }[];
}): AdminSignupRow {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    createdAt: row.createdAt.toISOString(),
    workspaces: row.memberships.map((membership) => ({
      id: membership.workspace.id,
      name: membership.workspace.name,
      plan: asPlanId(membership.workspace.plan),
    })),
  };
}

function parseMeta(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export async function getAdminDashboard(search?: string | null): Promise<AdminDashboard> {
  const q = search?.trim() || "";
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    totalWorkspaces,
    planGroups,
    running,
    needsYou,
    failedLast24h,
    tokenSums,
    usageSum,
    recentSignups,
    workspacesList,
    auditRows,
    searchHits,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.workspace.count(),
    prisma.workspace.groupBy({
      by: ["plan"],
      _count: { _all: true },
    }),
    prisma.job.count({ where: { status: { in: ["queued", "running"] } } }),
    prisma.job.count({ where: { status: "needs_you" } }),
    prisma.job.count({
      where: { status: "failed", updatedAt: { gte: since } },
    }),
    prisma.workspace.aggregate({
      _sum: { tokenUsed: true, tokenBudget: true },
    }),
    prisma.usageEvent.aggregate({
      _sum: { tokens: true },
    }),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        memberships: {
          include: {
            workspace: { select: { id: true, name: true, plan: true } },
          },
        },
      },
    }),
    prisma.workspace.findMany({
      orderBy: { createdAt: "desc" },
      take: 40,
      include: {
        members: {
          include: { user: { select: { email: true, name: true } } },
          take: 8,
        },
      },
    }),
    prisma.adminAuditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
    q
      ? prisma.user.findMany({
          where: { email: { contains: q, mode: "insensitive" } },
          take: 25,
          orderBy: { createdAt: "desc" },
          include: {
            memberships: {
              include: {
                workspace: { select: { id: true, name: true, plan: true } },
              },
            },
          },
        })
      : Promise.resolve(null),
  ]);

  const byPlan: Record<PlanId, number> = {
    demo: 0,
    starter: 0,
    pro: 0,
    ultra: 0,
  };
  for (const row of planGroups) {
    byPlan[asPlanId(row.plan)] += row._count._all;
  }
  const paid = byPlan.starter + byPlan.pro + byPlan.ultra;
  const free = byPlan.demo;

  return {
    users: { total: totalUsers },
    workspaces: {
      total: totalWorkspaces,
      byPlan,
      paid,
      free,
    },
    jobs: {
      running,
      needsYou,
      failedLast24h,
    },
    usage: {
      tokensUsedThisCycle: tokenSums._sum.tokenUsed ?? 0,
      tokenBudgetTotal: tokenSums._sum.tokenBudget ?? 0,
      usageEventTokens: usageSum._sum.tokens ?? 0,
    },
    recentSignups: recentSignups.map(serializeSignup),
    workspacesList: workspacesList.map(serializeWorkspaceRow),
    audit: auditRows.map((row) => {
      const meta = parseMeta(row.meta);
      const model =
        typeof meta.providerModelId === "string"
          ? describeProviderModel(meta.providerModelId)
          : null;
      return {
        id: row.id,
        actorEmail: row.actorEmail,
        action: row.action,
        targetId: row.targetId,
        meta,
        createdAt: row.createdAt.toISOString(),
        displayName: model?.displayName,
        providerModelId: model?.providerModelId,
      };
    }),
    search: searchHits ? searchHits.map(serializeSignup) : null,
  };
}

async function writeAudit(input: {
  actorEmail: string;
  action: string;
  targetId: string;
  meta?: Record<string, unknown>;
}) {
  await prisma.adminAuditLog.create({
    data: {
      actorEmail: input.actorEmail,
      action: input.action,
      targetId: input.targetId,
      meta: JSON.stringify(input.meta ?? {}),
    },
  });
}

async function setWorkspacePlan(input: {
  workspaceId: string;
  plan: PlanId;
  resetUsage: boolean;
}) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: input.workspaceId },
    select: { id: true, name: true, plan: true },
  });
  if (!workspace) {
    throw new ClientError("Workspace not found.", 404, "not_found");
  }
  const tokenBudget = planBudget(input.plan);
  const updated = await prisma.workspace.update({
    where: { id: workspace.id },
    data: {
      plan: input.plan,
      tokenBudget,
      ...(input.resetUsage ? { tokenUsed: 0 } : {}),
      ...(input.plan === "demo" ? { whopMembershipId: null } : {}),
    },
    include: {
      members: {
        include: { user: { select: { email: true, name: true } } },
        take: 8,
      },
    },
  });
  return { before: workspace, updated: serializeWorkspaceRow(updated) };
}

async function workspaceIdsForUserEmail(email: string): Promise<{
  userId: string;
  email: string;
  workspaceIds: string[];
}> {
  const user = await prisma.user.findFirst({
    where: { email: { equals: email.trim(), mode: "insensitive" } },
    select: {
      id: true,
      email: true,
      memberships: { select: { workspaceId: true } },
    },
  });
  if (!user) {
    throw new ClientError("No user with that email.", 404, "not_found");
  }
  return {
    userId: user.id,
    email: user.email,
    workspaceIds: user.memberships.map((row) => row.workspaceId),
  };
}

export async function adminAssignPlan(input: {
  actorEmail: string;
  plan: string;
  workspaceId?: string | null;
  userEmail?: string | null;
}): Promise<{ workspaces: AdminWorkspaceRow[] }> {
  const plan = asPlanId(input.plan);
  if (!(plan in PLANS)) {
    throw new ClientError("Choose demo, starter, pro, or ultra.");
  }
  const ids: string[] = [];
  let userTarget: string | null = null;
  if (input.workspaceId?.trim()) {
    ids.push(input.workspaceId.trim());
  }
  if (input.userEmail?.trim()) {
    const found = await workspaceIdsForUserEmail(input.userEmail);
    userTarget = found.email;
    ids.push(...found.workspaceIds);
  }
  const unique = [...new Set(ids)];
  if (!unique.length) {
    throw new ClientError("Choose a workspace or a user email.");
  }

  const workspaces: AdminWorkspaceRow[] = [];
  for (const workspaceId of unique) {
    const { before, updated } = await setWorkspacePlan({
      workspaceId,
      plan,
      resetUsage: true,
    });
    workspaces.push(updated);
    await writeAudit({
      actorEmail: input.actorEmail,
      action: "assign_plan",
      targetId: workspaceId,
      meta: {
        plan,
        previousPlan: before.plan,
        workspaceName: before.name,
        userEmail: userTarget,
        tokenBudget: updated.tokenBudget,
      },
    });
  }
  return { workspaces };
}

export async function adminRevokePlan(input: {
  actorEmail: string;
  workspaceId?: string | null;
  userEmail?: string | null;
}): Promise<{ workspaces: AdminWorkspaceRow[] }> {
  const ids: string[] = [];
  let userTarget: string | null = null;
  if (input.workspaceId?.trim()) {
    ids.push(input.workspaceId.trim());
  }
  if (input.userEmail?.trim()) {
    const found = await workspaceIdsForUserEmail(input.userEmail);
    userTarget = found.email;
    ids.push(...found.workspaceIds);
  }
  const unique = [...new Set(ids)];
  if (!unique.length) {
    throw new ClientError("Choose a workspace or a user email.");
  }

  const workspaces: AdminWorkspaceRow[] = [];
  for (const workspaceId of unique) {
    const { before, updated } = await setWorkspacePlan({
      workspaceId,
      plan: "demo",
      resetUsage: true,
    });
    workspaces.push(updated);
    await writeAudit({
      actorEmail: input.actorEmail,
      action: "revoke_plan",
      targetId: workspaceId,
      meta: {
        plan: "demo",
        previousPlan: before.plan,
        workspaceName: before.name,
        userEmail: userTarget,
        tokenBudget: updated.tokenBudget,
      },
    });
  }
  return { workspaces };
}
