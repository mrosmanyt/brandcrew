import { ForbiddenError, requireUser, type SessionUser } from "@/lib/auth";
import { planBudget } from "@/lib/billing";
import { prisma } from "@/lib/db";
import { isPaidPlan, normalizePlanId } from "@/lib/limits";
import type { PlanId } from "@/lib/constants";
import { PLANS } from "@/lib/constants";
import { ClientError } from "@/lib/http";
import {
  parseAssistantBillingPlanId,
  type AssistantBillingPlanId,
} from "@/lib/cinem-ai-assistant-billing";
import { hasAnthropic, hasGemini, hasOpenAI, hasXai } from "@/lib/llm";
import {
  describeProviderModel,
  DISPLAY_MODELS,
  providerModelIdFor,
  type DisplayModelId,
} from "@/lib/model-catalog";

export const DEFAULT_ADMIN_EMAIL = "cinemtech@gmail.com";
/** Founder inbox — always allowed even if omitted from ADMIN_EMAILS. */
export const FOUNDER_ADMIN_EMAIL = "mrosmanyt@gmail.com";
export const DEFAULT_ADMIN_EMAILS = [DEFAULT_ADMIN_EMAIL, FOUNDER_ADMIN_EMAIL] as const;

export const ADMIN_SECTIONS = [
  "overview",
  "customers",
  "billing",
  "models",
  "access",
  "audit",
  "trust",
  "flags",
] as const;

export type AdminSection = (typeof ADMIN_SECTIONS)[number];

export function parseAdminEmails(raw?: string | null): string[] {
  const extras = (raw ?? "")
    .split(",")
    .map((row) => row.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set([...DEFAULT_ADMIN_EMAILS, ...extras])];
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

/** Mask the local part; keep the domain so founders can tell gmail vs company mail. */
export function maskAdminEmail(email: string): string {
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.lastIndexOf("@");
  if (at <= 0) return "***";
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  if (!domain) return "***";
  return `${"*".repeat(Math.max(local.length, 3))}@${domain}`;
}

export function emailDomain(email: string): string {
  const at = email.lastIndexOf("@");
  return at >= 0 ? email.slice(at + 1).toLowerCase() : "";
}

export function parseAdminSection(raw?: string | null): AdminSection {
  const value = (raw ?? "").trim().toLowerCase();
  if ((ADMIN_SECTIONS as readonly string[]).includes(value)) {
    return value as AdminSection;
  }
  return "overview";
}

export function sanitizeFlagKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9_.-]/g, "").slice(0, 64);
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
  suspended: boolean;
  tokenUsed: number;
  tokenBudget: number;
  chatTokenUsed: number;
  whopMembershipId: string | null;
  createdAt: string;
  ownerEmail: string | null;
  ownerName: string | null;
};

export type AdminSignupRow = {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  workspaces: { id: string; name: string; plan: PlanId; suspended: boolean }[];
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

export type AdminMemberRow = {
  userId: string;
  email: string;
  name: string;
  role: string;
};

export type AdminJobPeek = {
  id: string;
  title: string;
  status: string;
  agentRole: string;
  createdAt: string;
};

export type AdminUsagePeek = {
  id: string;
  tokens: number;
  model: string;
  displayName: string;
  providerModelId: string;
  createdAt: string;
};

export type AdminWorkspace360 = AdminWorkspaceRow & {
  members: AdminMemberRow[];
  recentJobs: AdminJobPeek[];
  recentUsage: AdminUsagePeek[];
};

export type AdminCustomer360 = {
  user: { id: string; email: string; name: string; createdAt: string };
  assistantPro: {
    status: string;
    plan: string;
    currentPeriodEnd: string | null;
  } | null;
  workspaces: AdminWorkspace360[];
};

export type AdminJobFailureRow = {
  id: string;
  title: string;
  status: string;
  error: string;
  workspaceId: string;
  workspaceName: string;
  updatedAt: string;
};

export type AdminApprovalRow = {
  id: string;
  title: string;
  askKind: string;
  status: string;
  workspaceId: string;
  workspaceName: string;
  createdAt: string;
};

export type AdminBillingEventRow = {
  id: string;
  kind: "support" | "webhook";
  status: string;
  eventType?: string;
  amountCents?: number;
  currency?: string;
  email?: string;
  provider?: string;
  externalId?: string | null;
  createdAt: string;
};

export type AdminDashboard = {
  section: "overview";
  users: { total: number };
  workspaces: {
    total: number;
    byPlan: Record<PlanId, number>;
    paid: number;
    free: number;
    suspended: number;
  };
  jobs: {
    running: number;
    needsYou: number;
    failedLast24h: number;
    createdLast24h: number;
  };
  usage: {
    tokensUsedThisCycle: number;
    tokenBudgetTotal: number;
    chatTokenUsed: number;
    usageEventTokens: number;
  };
  billing: {
    supportPaid: number;
    supportPending: number;
    webhooksLast7d: number;
  };
  helpdesk: {
    open: number;
    live: number;
  };
  failedJobs: AdminJobFailureRow[];
  approvals: AdminApprovalRow[];
  recentSignups: AdminSignupRow[];
  workspacesList: AdminWorkspaceRow[];
  audit: AdminAuditRow[];
  search: AdminSignupRow[] | null;
};

export type AdminCustomersPayload = {
  section: "customers";
  results: AdminSignupRow[];
  profile: AdminCustomer360 | null;
};

export type AdminBillingPayload = {
  section: "billing";
  paid: AdminWorkspaceRow[];
  credits: null;
  creditsNote: string;
  supports: AdminBillingEventRow[];
  webhooks: AdminBillingEventRow[];
};

export type AdminModelsPayload = {
  section: "models";
  catalog: {
    displayName: string;
    catalogId: DisplayModelId;
    backendClass: string;
    provider: string;
    configuredProviderModelId: string;
  }[];
  keysPresent: {
    openai: boolean;
    anthropic: boolean;
    gemini: boolean;
    xai: boolean;
  };
  usageByProviderModelId: {
    providerModelId: string;
    displayName: string;
    tokens: number;
    events: number;
  }[];
  usageEventTokens: number;
  note: string;
};

export type AdminAccessPayload = {
  section: "access";
  role: "superadmin";
  source: "ADMIN_EMAILS";
  sso: { status: "not_wired"; note: string };
  emails: {
    masked: string;
    domain: string;
    role: "superadmin";
    isDefault: boolean;
  }[];
  note: string;
};

export type AdminAuditPayload = {
  section: "audit";
  rows: AdminAuditRow[];
  filters: { action: string; actor: string; q: string };
};

export type AdminTrustPayload = {
  section: "trust";
  users: AdminSignupRow[];
  workspaces: AdminWorkspaceRow[];
};

export type AdminFlagRow = {
  key: string;
  enabled: boolean;
  note: string;
  updatedAt: string;
  updatedBy: string;
};

export type AdminFlagsPayload = {
  section: "flags";
  flags: AdminFlagRow[];
};

const workspaceListInclude = {
  members: {
    include: { user: { select: { id: true, email: true, name: true } } },
    take: 16,
  },
} as const;

function serializeWorkspaceRow(row: {
  id: string;
  name: string;
  slug: string;
  plan: string;
  tokenUsed: number;
  tokenBudget: number;
  chatTokenUsed?: number;
  suspended?: boolean;
  whopMembershipId?: string | null;
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
    suspended: Boolean(row.suspended),
    tokenUsed: row.tokenUsed,
    tokenBudget: row.tokenBudget,
    chatTokenUsed: row.chatTokenUsed ?? 0,
    whopMembershipId: row.whopMembershipId ?? null,
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
  memberships: {
    workspace: { id: string; name: string; plan: string; suspended?: boolean };
  }[];
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
      suspended: Boolean(membership.workspace.suspended),
    })),
  };
}

function truncateJobError(raw?: string | null): string {
  const text = (raw ?? "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  return text.length > 240 ? `${text.slice(0, 237)}…` : text;
}

function parseMeta(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function serializeAudit(row: {
  id: string;
  actorEmail: string;
  action: string;
  targetId: string;
  meta: string;
  createdAt: Date;
}): AdminAuditRow {
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
}

function emptyByPlan(): Record<PlanId, number> {
  return { demo: 0, starter: 0, pro: 0, ultra: 0 };
}

export async function getAdminDashboard(search?: string | null): Promise<AdminDashboard> {
  const q = search?.trim() || "";
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [
    totalUsers,
    totalWorkspaces,
    planGroups,
    suspendedCount,
    running,
    needsYou,
    failedLast24h,
    createdLast24h,
    tokenSums,
    usageSum,
    recentSignups,
    workspacesList,
    auditRows,
    searchHits,
    failedJobs,
    approvalJobs,
    supportPaid,
    supportPending,
    webhooksLast7d,
    helpdeskOpen,
    helpdeskLive,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.workspace.count(),
    prisma.workspace.groupBy({
      by: ["plan"],
      _count: { _all: true },
    }),
    prisma.workspace.count({ where: { suspended: true } }),
    prisma.job.count({ where: { status: { in: ["queued", "running"] } } }),
    prisma.job.count({ where: { status: "needs_you" } }),
    prisma.job.count({
      where: { status: "failed", updatedAt: { gte: since } },
    }),
    prisma.job.count({ where: { createdAt: { gte: since } } }),
    prisma.workspace.aggregate({
      _sum: { tokenUsed: true, tokenBudget: true, chatTokenUsed: true },
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
            workspace: {
              select: { id: true, name: true, plan: true, suspended: true },
            },
          },
        },
      },
    }),
    prisma.workspace.findMany({
      orderBy: { createdAt: "desc" },
      take: 40,
      include: workspaceListInclude,
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
                workspace: {
                  select: { id: true, name: true, plan: true, suspended: true },
                },
              },
            },
          },
        })
      : Promise.resolve(null),
    prisma.job.findMany({
      where: { status: "failed" },
      orderBy: { updatedAt: "desc" },
      take: 12,
      select: {
        id: true,
        title: true,
        status: true,
        error: true,
        workspaceId: true,
        updatedAt: true,
        workspace: { select: { name: true } },
      },
    }),
    prisma.job.findMany({
      where: { status: "needs_you" },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: {
        id: true,
        title: true,
        status: true,
        askKind: true,
        workspaceId: true,
        createdAt: true,
        workspace: { select: { name: true } },
      },
    }),
    prisma.brandSupport.count({ where: { status: "paid" } }),
    prisma.brandSupport.count({ where: { status: { not: "paid" } } }),
    prisma.processedWebhook.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.supportThread.count({ where: { status: { in: ["open", "live"] } } }),
    prisma.supportThread.count({ where: { status: "live" } }),
  ]);

  const byPlan = emptyByPlan();
  for (const row of planGroups) {
    byPlan[asPlanId(row.plan)] += row._count._all;
  }
  const paid = byPlan.starter + byPlan.pro + byPlan.ultra;
  const free = byPlan.demo;

  return {
    section: "overview",
    users: { total: totalUsers },
    workspaces: {
      total: totalWorkspaces,
      byPlan,
      paid,
      free,
      suspended: suspendedCount,
    },
    jobs: {
      running,
      needsYou,
      failedLast24h,
      createdLast24h,
    },
    usage: {
      tokensUsedThisCycle: tokenSums._sum.tokenUsed ?? 0,
      tokenBudgetTotal: tokenSums._sum.tokenBudget ?? 0,
      chatTokenUsed: tokenSums._sum.chatTokenUsed ?? 0,
      usageEventTokens: usageSum._sum.tokens ?? 0,
    },
    billing: {
      supportPaid,
      supportPending,
      webhooksLast7d,
    },
    helpdesk: {
      open: helpdeskOpen,
      live: helpdeskLive,
    },
    failedJobs: failedJobs.map((job) => ({
      id: job.id,
      title: job.title,
      status: job.status,
      error: truncateJobError(job.error),
      workspaceId: job.workspaceId,
      workspaceName: job.workspace.name,
      updatedAt: job.updatedAt.toISOString(),
    })),
    approvals: approvalJobs.map((job) => ({
      id: job.id,
      title: job.title,
      askKind: job.askKind,
      status: job.status,
      workspaceId: job.workspaceId,
      workspaceName: job.workspace.name,
      createdAt: job.createdAt.toISOString(),
    })),
    recentSignups: recentSignups.map(serializeSignup),
    workspacesList: workspacesList.map(serializeWorkspaceRow),
    audit: auditRows.map(serializeAudit),
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

export async function recordAdminAccess(input: {
  actorEmail: string;
  path: string;
}) {
  await writeAudit({
    actorEmail: input.actorEmail,
    action: "admin_access",
    targetId: input.path,
    meta: { path: input.path, kind: "page_view" },
  });
}

export async function exportAdminAudit(input: {
  actorEmail: string;
  action?: string | null;
  actor?: string | null;
  q?: string | null;
}) {
  const { packAdminAuditExport } = await import("@/lib/audit-export");
  const action = input.action?.trim() || "";
  const actor = input.actor?.trim() || "";
  const q = input.q?.trim() || "";
  const rows = await prisma.adminAuditLog.findMany({
    where: {
      ...(action ? { action } : {}),
      ...(actor ? { actorEmail: { contains: actor, mode: "insensitive" } } : {}),
      ...(q
        ? {
            OR: [
              { targetId: { contains: q, mode: "insensitive" } },
              { meta: { contains: q, mode: "insensitive" } },
              { action: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "asc" },
    take: 500,
  });
  await writeAudit({
    actorEmail: input.actorEmail,
    action: "admin_audit_export",
    targetId: "admin_audit",
    meta: { count: rows.length, action, actor, q },
  });
  return packAdminAuditExport({
    exportedBy: input.actorEmail,
    rows,
  });
}

async function setWorkspacePlan(input: {
  workspaceId: string;
  plan: PlanId;
  resetUsage: boolean;
  suspended?: boolean;
}) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: input.workspaceId },
    select: { id: true, name: true, plan: true, suspended: true },
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
      ...(input.resetUsage ? { tokenUsed: 0, chatTokenUsed: 0 } : {}),
      ...(input.plan === "demo" ? { whopMembershipId: null } : {}),
      ...(typeof input.suspended === "boolean" ? { suspended: input.suspended } : {}),
    },
    include: workspaceListInclude,
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

async function resolveWorkspaceIds(input: {
  workspaceId?: string | null;
  userEmail?: string | null;
}): Promise<{ ids: string[]; userTarget: string | null }> {
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
  return { ids: unique, userTarget };
}

export async function adminAssignPlan(input: {
  actorEmail: string;
  plan: string;
  workspaceId?: string | null;
  userEmail?: string | null;
}): Promise<{ workspaces: AdminWorkspaceRow[] }> {
  const plan = asPlanId(input.plan);
  if (!(plan in PLANS)) {
    throw new ClientError("Choose free, starter, pro, or ultra.");
  }
  const { ids, userTarget } = await resolveWorkspaceIds(input);

  const workspaces: AdminWorkspaceRow[] = [];
  for (const workspaceId of ids) {
    const { before, updated } = await setWorkspacePlan({
      workspaceId,
      plan,
      resetUsage: true,
      suspended: false,
    });
    workspaces.push(updated);
    await writeAudit({
      actorEmail: input.actorEmail,
      action: "assign_plan",
      targetId: workspaceId,
      meta: {
        plan,
        previousPlan: before.plan,
        previousSuspended: before.suspended,
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
  const { ids, userTarget } = await resolveWorkspaceIds(input);

  const workspaces: AdminWorkspaceRow[] = [];
  for (const workspaceId of ids) {
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

async function resolveUserIdByEmail(email: string) {
  const user = await prisma.user.findFirst({
    where: { email: { equals: email.trim(), mode: "insensitive" } },
    select: { id: true, email: true },
  });
  if (!user) {
    throw new ClientError("No user with that email.", 404, "not_found");
  }
  return user;
}

export async function adminGrantAssistantPro(input: {
  actorEmail: string;
  userEmail: string;
  plan?: string | null;
}): Promise<{
  userId: string;
  email: string;
  assistantPro: AdminCustomer360["assistantPro"];
}> {
  const user = await resolveUserIdByEmail(input.userEmail);
  const plan: AssistantBillingPlanId =
    parseAssistantBillingPlanId(input.plan) || "monthly";
  const row = await prisma.assistantSubscription.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      plan,
      status: "active",
      currentPeriodEnd: null,
      whopMembershipId: null,
    },
    update: {
      plan,
      status: "active",
      currentPeriodEnd: null,
      whopMembershipId: null,
    },
    select: { status: true, plan: true, currentPeriodEnd: true },
  });
  await writeAudit({
    actorEmail: input.actorEmail,
    action: "assistant_pro_grant",
    targetId: user.id,
    meta: { userEmail: user.email, plan },
  });
  return {
    userId: user.id,
    email: user.email,
    assistantPro: {
      status: row.status,
      plan: row.plan,
      currentPeriodEnd: row.currentPeriodEnd?.toISOString() ?? null,
    },
  };
}

export async function adminRevokeAssistantPro(input: {
  actorEmail: string;
  userEmail: string;
}): Promise<{ userId: string; email: string }> {
  const user = await resolveUserIdByEmail(input.userEmail);
  await prisma.assistantSubscription.updateMany({
    where: { userId: user.id },
    data: { status: "cancelled", whopMembershipId: null },
  });
  await writeAudit({
    actorEmail: input.actorEmail,
    action: "assistant_pro_revoke",
    targetId: user.id,
    meta: { userEmail: user.email },
  });
  return { userId: user.id, email: user.email };
}

export async function adminSuspendWorkspace(input: {
  actorEmail: string;
  workspaceId?: string | null;
  userEmail?: string | null;
}): Promise<{ workspaces: AdminWorkspaceRow[] }> {
  const { ids, userTarget } = await resolveWorkspaceIds(input);
  const workspaces: AdminWorkspaceRow[] = [];
  for (const workspaceId of ids) {
    const { before, updated } = await setWorkspacePlan({
      workspaceId,
      plan: "demo",
      resetUsage: true,
      suspended: true,
    });
    workspaces.push(updated);
    await writeAudit({
      actorEmail: input.actorEmail,
      action: "suspend",
      targetId: workspaceId,
      meta: {
        plan: "demo",
        previousPlan: before.plan,
        previousSuspended: before.suspended,
        workspaceName: before.name,
        userEmail: userTarget,
        note: "Soft suspend: Free plan, jobs blocked.",
      },
    });
  }
  return { workspaces };
}

export async function adminUnsuspendWorkspace(input: {
  actorEmail: string;
  workspaceId?: string | null;
  userEmail?: string | null;
}): Promise<{ workspaces: AdminWorkspaceRow[] }> {
  const { ids, userTarget } = await resolveWorkspaceIds(input);
  const workspaces: AdminWorkspaceRow[] = [];
  for (const workspaceId of ids) {
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: workspaceListInclude,
    });
    if (!workspace) {
      throw new ClientError("Workspace not found.", 404, "not_found");
    }
    const updated = await prisma.workspace.update({
      where: { id: workspaceId },
      data: { suspended: false },
      include: workspaceListInclude,
    });
    workspaces.push(serializeWorkspaceRow(updated));
    await writeAudit({
      actorEmail: input.actorEmail,
      action: "unsuspend",
      targetId: workspaceId,
      meta: {
        previousSuspended: workspace.suspended,
        workspaceName: workspace.name,
        userEmail: userTarget,
        plan: updated.plan,
        note: "Cleared suspend flag. Plan is unchanged (assign a paid plan separately).",
      },
    });
  }
  return { workspaces };
}

export async function adminSetBudget(input: {
  actorEmail: string;
  tokenBudget: number;
  workspaceId?: string | null;
  userEmail?: string | null;
}): Promise<{ workspaces: AdminWorkspaceRow[] }> {
  const tokenBudget = Math.round(input.tokenBudget);
  if (!Number.isFinite(tokenBudget) || tokenBudget < 1 || tokenBudget > 5_000_000) {
    throw new ClientError("Token budget must be between 1 and 5,000,000.");
  }
  const { ids, userTarget } = await resolveWorkspaceIds(input);
  const workspaces: AdminWorkspaceRow[] = [];
  for (const workspaceId of ids) {
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true, name: true, tokenBudget: true, plan: true },
    });
    if (!workspace) {
      throw new ClientError("Workspace not found.", 404, "not_found");
    }
    const updated = await prisma.workspace.update({
      where: { id: workspaceId },
      data: { tokenBudget },
      include: workspaceListInclude,
    });
    workspaces.push(serializeWorkspaceRow(updated));
    await writeAudit({
      actorEmail: input.actorEmail,
      action: "set_budget",
      targetId: workspaceId,
      meta: {
        tokenBudget,
        previousTokenBudget: workspace.tokenBudget,
        workspaceName: workspace.name,
        plan: workspace.plan,
        userEmail: userTarget,
        note: "Token budget override. Plan is unchanged.",
      },
    });
  }
  return { workspaces };
}

export async function recordAdminBackupExport(input: {
  actorEmail: string;
  counts: Record<string, number>;
  full: boolean;
}) {
  await writeAudit({
    actorEmail: input.actorEmail,
    action: "admin_backup_export",
    targetId: "admin_backup",
    meta: { ...input.counts, full: input.full },
  });
}

async function loadCustomer360(userId: string): Promise<AdminCustomer360 | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      assistantSubscription: {
        select: { status: true, plan: true, currentPeriodEnd: true },
      },
      memberships: {
        include: {
          workspace: {
            include: {
              members: {
                include: { user: { select: { id: true, email: true, name: true } } },
              },
              jobs: {
                orderBy: { createdAt: "desc" },
                take: 12,
                select: {
                  id: true,
                  title: true,
                  status: true,
                  agentRole: true,
                  createdAt: true,
                },
              },
              usageEvents: {
                orderBy: { createdAt: "desc" },
                take: 15,
                select: {
                  id: true,
                  tokens: true,
                  model: true,
                  createdAt: true,
                },
              },
            },
          },
        },
      },
    },
  });
  if (!user) return null;
  const sub = user.assistantSubscription;
  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt.toISOString(),
    },
    assistantPro: sub
      ? {
          status: sub.status,
          plan: sub.plan,
          currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
        }
      : null,
    workspaces: user.memberships.map((membership) => {
      const ws = membership.workspace;
      return {
        ...serializeWorkspaceRow(ws),
        members: ws.members.map((member) => ({
          userId: member.user.id,
          email: member.user.email,
          name: member.user.name,
          role: member.role,
        })),
        recentJobs: ws.jobs.map((job) => ({
          id: job.id,
          title: job.title,
          status: job.status,
          agentRole: job.agentRole,
          createdAt: job.createdAt.toISOString(),
        })),
        recentUsage: ws.usageEvents.map((event) => {
          const described = describeProviderModel(event.model);
          return {
            id: event.id,
            tokens: event.tokens,
            model: event.model,
            displayName: described.displayName,
            providerModelId: described.providerModelId,
            createdAt: event.createdAt.toISOString(),
          };
        }),
      };
    }),
  };
}

export async function getAdminCustomers(input: {
  q?: string | null;
  userId?: string | null;
}): Promise<AdminCustomersPayload> {
  const q = input.q?.trim() || "";
  const userId = input.userId?.trim() || "";
  const results = (
    await prisma.user.findMany({
      where: q ? { email: { contains: q, mode: "insensitive" } } : undefined,
      take: q ? 25 : 40,
      orderBy: { createdAt: "desc" },
      include: {
        memberships: {
          include: {
            workspace: {
              select: { id: true, name: true, plan: true, suspended: true },
            },
          },
        },
      },
    })
  ).map(serializeSignup);

  let profile: AdminCustomer360 | null = null;
  if (userId) {
    profile = await loadCustomer360(userId);
  } else if (results.length === 1) {
    profile = await loadCustomer360(results[0].id);
  }
  return { section: "customers", results, profile };
}

export async function getAdminBilling(): Promise<AdminBillingPayload> {
  const [paid, supports, webhooks] = await Promise.all([
    prisma.workspace.findMany({
      where: { plan: { not: "demo" } },
      orderBy: { updatedAt: "desc" },
      take: 80,
      include: workspaceListInclude,
    }),
    prisma.brandSupport.findMany({
      orderBy: { createdAt: "desc" },
      take: 40,
      select: {
        id: true,
        amountCents: true,
        currency: true,
        email: true,
        status: true,
        provider: true,
        paymentId: true,
        createdAt: true,
      },
    }),
    prisma.processedWebhook.findMany({
      orderBy: { createdAt: "desc" },
      take: 40,
      select: {
        id: true,
        eventType: true,
        externalId: true,
        createdAt: true,
      },
    }),
  ]);
  return {
    section: "billing",
    paid: paid.map(serializeWorkspaceRow),
    credits: null,
    creditsNote:
      "No credits column exists on Workspace. Credits are token budget 1:1. This page does not invent a balance.",
    supports: supports.map((row) => ({
      id: row.id,
      kind: "support" as const,
      status: row.status,
      amountCents: row.amountCents,
      currency: row.currency,
      email: row.email,
      provider: row.provider,
      externalId: row.paymentId,
      createdAt: row.createdAt.toISOString(),
    })),
    webhooks: webhooks.map((row) => ({
      id: row.id,
      kind: "webhook" as const,
      status: "processed",
      eventType: row.eventType,
      externalId: row.externalId,
      createdAt: row.createdAt.toISOString(),
    })),
  };
}

export function getProviderKeysPresent() {
  return {
    openai: hasOpenAI(),
    anthropic: hasAnthropic(),
    gemini: hasGemini(),
    xai: hasXai(),
  };
}

export function getAdminModelCatalog() {
  return DISPLAY_MODELS.map((row) => ({
    displayName: row.displayName,
    catalogId: row.id,
    backendClass: row.backendClass,
    provider: row.provider,
    configuredProviderModelId: providerModelIdFor(row.id),
  }));
}

export async function getAdminModels(): Promise<AdminModelsPayload> {
  const [groups, usageSum] = await Promise.all([
    prisma.usageEvent.groupBy({
      by: ["model"],
      _sum: { tokens: true },
      _count: { _all: true },
    }),
    prisma.usageEvent.aggregate({ _sum: { tokens: true } }),
  ]);
  const usageByProviderModelId = groups
    .map((row) => {
      const described = describeProviderModel(row.model);
      return {
        providerModelId: described.providerModelId,
        displayName: described.displayName,
        tokens: row._sum.tokens ?? 0,
        events: row._count._all,
      };
    })
    .sort((a, b) => b.tokens - a.tokens);
  return {
    section: "models",
    catalog: getAdminModelCatalog(),
    keysPresent: getProviderKeysPresent(),
    usageByProviderModelId,
    usageEventTokens: usageSum._sum.tokens ?? 0,
    note: usageByProviderModelId.length
      ? "Breakdown is UsageEvent.model (provider id stored at job time)."
      : "No UsageEvent rows yet, so there is no per-model breakdown. Workspace.tokenUsed totals are on Overview.",
  };
}

export function getAdminAccess(): AdminAccessPayload {
  const emails = adminEmails();
  return {
    section: "access",
    role: "superadmin",
    source: "ADMIN_EMAILS",
    sso: {
      status: "not_wired",
      note: "SSO is not wired. The only role is superadmin, granted by ADMIN_EMAILS.",
    },
    emails: emails.map((email) => ({
      masked: maskAdminEmail(email),
      domain: emailDomain(email),
      role: "superadmin" as const,
      isDefault: (DEFAULT_ADMIN_EMAILS as readonly string[]).includes(email),
    })),
    note: "Set ADMIN_EMAILS on Vercel (Production and Preview) to every staff email that should open /admin. cinemtech@gmail.com and mrosmanyt@gmail.com are always included even if omitted. A signed-in address missing from the list receives 403.",
  };
}

export async function getAdminAudit(input: {
  action?: string | null;
  actor?: string | null;
  q?: string | null;
}): Promise<AdminAuditPayload> {
  const action = input.action?.trim() || "";
  const actor = input.actor?.trim() || "";
  const q = input.q?.trim() || "";
  const rows = await prisma.adminAuditLog.findMany({
    where: {
      ...(action ? { action } : {}),
      ...(actor ? { actorEmail: { contains: actor, mode: "insensitive" } } : {}),
      ...(q
        ? {
            OR: [
              { targetId: { contains: q, mode: "insensitive" } },
              { meta: { contains: q, mode: "insensitive" } },
              { action: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 80,
  });
  return {
    section: "audit",
    rows: rows.map(serializeAudit),
    filters: { action, actor, q },
  };
}

export async function getAdminTrust(input: {
  q?: string | null;
}): Promise<AdminTrustPayload> {
  const q = input.q?.trim() || "";
  if (!q) {
    return { section: "trust", users: [], workspaces: [] };
  }
  const [users, workspaces] = await Promise.all([
    prisma.user.findMany({
      where: { email: { contains: q, mode: "insensitive" } },
      take: 25,
      orderBy: { createdAt: "desc" },
      include: {
        memberships: {
          include: {
            workspace: {
              select: { id: true, name: true, plan: true, suspended: true },
            },
          },
        },
      },
    }),
    prisma.workspace.findMany({
      where: {
        OR: [
          { id: q },
          { name: { contains: q, mode: "insensitive" } },
          { slug: { contains: q, mode: "insensitive" } },
          {
            members: {
              some: { user: { email: { contains: q, mode: "insensitive" } } },
            },
          },
        ],
      },
      take: 25,
      orderBy: { updatedAt: "desc" },
      include: workspaceListInclude,
    }),
  ]);
  return {
    section: "trust",
    users: users.map(serializeSignup),
    workspaces: workspaces.map(serializeWorkspaceRow),
  };
}

export async function getAdminFlags(): Promise<AdminFlagsPayload> {
  const flags = await prisma.featureFlag.findMany({
    orderBy: { key: "asc" },
  });
  return {
    section: "flags",
    flags: flags.map((row) => ({
      key: row.key,
      enabled: row.enabled,
      note: row.note,
      updatedAt: row.updatedAt.toISOString(),
      updatedBy: row.updatedBy,
    })),
  };
}

export async function isFeatureEnabled(key: string): Promise<boolean> {
  const row = await prisma.featureFlag.findUnique({
    where: { key: sanitizeFlagKey(key) },
    select: { enabled: true },
  });
  return row?.enabled === true;
}

export async function adminSetFeatureFlag(input: {
  actorEmail: string;
  key: string;
  enabled: boolean;
  note?: string | null;
}): Promise<AdminFlagRow> {
  const key = sanitizeFlagKey(input.key);
  if (!key) {
    throw new ClientError("Use a short flag key (letters, numbers, _ . -).");
  }
  const existing = await prisma.featureFlag.findUnique({ where: { key } });
  const row = await prisma.featureFlag.upsert({
    where: { key },
    create: {
      key,
      enabled: input.enabled,
      note: input.note?.trim() || "",
      updatedBy: input.actorEmail,
    },
    update: {
      enabled: input.enabled,
      ...(input.note !== undefined && input.note !== null
        ? { note: input.note.trim() }
        : {}),
      updatedBy: input.actorEmail,
    },
  });
  await writeAudit({
    actorEmail: input.actorEmail,
    action: existing ? "toggle_flag" : "create_flag",
    targetId: key,
    meta: {
      enabled: row.enabled,
      note: row.note,
      previousEnabled: existing?.enabled ?? null,
    },
  });
  return {
    key: row.key,
    enabled: row.enabled,
    note: row.note,
    updatedAt: row.updatedAt.toISOString(),
    updatedBy: row.updatedBy,
  };
}
