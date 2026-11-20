/**
 * Admin Panel (v1) data layer — CINEM Pro's owner-only panel at /admin.
 *
 * Every number here comes from a real Prisma table. There is deliberately
 * NO page-view / referrer / device analytics: the only traffic source in
 * the codebase is FunnelEvent (marketing site_visit rows with a path),
 * which powers the "Top pages" card and nothing else.
 *
 * Access is NOT decided here — callers go through requireAdmin() /
 * loadAdminPage() (ADMIN_EMAILS allowlist in src/lib/admin.ts).
 */
import { PLANS, planDisplayName, type PlanId } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { foundingSpotsSnapshot, getSiteConfig } from "@/lib/founding-members";
import { normalizePlanId } from "@/lib/limits";

export const PANEL_RANGES = [7, 30, 90] as const;
export type PanelRangeDays = (typeof PANEL_RANGES)[number];

export function parsePanelRange(raw?: string | null): PanelRangeDays {
  const n = Number(raw);
  return (PANEL_RANGES as readonly number[]).includes(n) ? (n as PanelRangeDays) : 30;
}

function rangeStart(days: number): Date {
  const now = new Date();
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  start.setUTCDate(start.getUTCDate() - (days - 1));
  return start;
}

function dayKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function eachDay(days: number, start: Date): string[] {
  const keys: string[] = [];
  for (let i = 0; i < days; i++) {
    keys.push(dayKey(new Date(start.getTime() + i * 24 * 60 * 60 * 1000)));
  }
  return keys;
}

/* ------------------------------------------------------------------ */
/* Dashboard                                                           */
/* ------------------------------------------------------------------ */

export type PanelDayPoint = { date: string; signups: number; messages: number };

export type PanelDashboard = {
  rangeDays: PanelRangeDays;
  cards: {
    totalUsers: number;
    newSignups: number;
    activePaidPlans: number;
    messages: number;
    images: number;
    chatCredits: number;
  };
  series: PanelDayPoint[];
  planMix: { id: PlanId; name: string; price: number; workspaces: number }[];
  alerts: {
    foundingRemaining: number;
    foundingTotal: number;
    foundingClaimed: number;
    openSupport: number;
    liveSupport: number;
    suspendedWorkspaces: number;
    webhooksLast7d: number;
  };
  topPages: { path: string; visits: number; share: number }[];
  topPagesTotal: number;
  recentSignups: {
    id: string;
    email: string;
    name: string;
    planName: string;
    createdAt: string;
  }[];
};

type MembershipWithWorkspace = {
  role: string;
  workspace: {
    id: string;
    name: string;
    plan: string;
    tokenUsed: number;
    tokenBudget: number;
    chatTokenUsed: number;
    suspended: boolean;
    createdAt: Date;
  };
};

/** A user's primary workspace: the one they own, else their earliest. */
export function primaryWorkspace<T extends MembershipWithWorkspace>(
  memberships: T[],
): T["workspace"] | null {
  if (memberships.length === 0) return null;
  const sorted = [...memberships].sort((a, b) => {
    const aOwner = a.role === "owner" ? 0 : 1;
    const bOwner = b.role === "owner" ? 0 : 1;
    if (aOwner !== bOwner) return aOwner - bOwner;
    return a.workspace.createdAt.getTime() - b.workspace.createdAt.getTime();
  });
  return sorted[0].workspace;
}

/**
 * Structural row shapes for the queries below. The sandbox Prisma client
 * is stale (its inference degrades for these include/groupBy shapes), so
 * map callbacks are annotated explicitly. Shapes match
 * prisma/schema.prisma exactly, field for field.
 */
type PanelMembershipRow = {
  role: string;
  workspace: {
    id: string;
    name: string;
    plan: string;
    tokenUsed: number;
    tokenBudget: number;
    chatTokenUsed: number;
    suspended: boolean;
    createdAt: Date;
  };
};

type PanelMembershipDetailRow = {
  role: string;
  workspace: PanelMembershipRow["workspace"] & { whopMembershipId: string | null };
};

type PanelUserWithMemberships = {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
  assistantFoundingMember: boolean;
  assistantFoundingNumber: number | null;
  memberships: PanelMembershipRow[];
};

const membershipInclude = {
  memberships: {
    include: {
      workspace: {
        select: {
          id: true,
          name: true,
          plan: true,
          tokenUsed: true,
          tokenBudget: true,
          chatTokenUsed: true,
          suspended: true,
          createdAt: true,
        },
      },
    },
  },
} as const;

export async function getPanelDashboard(days: PanelRangeDays): Promise<PanelDashboard> {
  const since = rangeStart(days);
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    newSignups,
    planGroups,
    messages,
    images,
    chatCredits,
    signupRows,
    messageRows,
    founding,
    openSupport,
    liveSupport,
    suspendedWorkspaces,
    webhooksLast7d,
    funnelRows,
    recentUsers,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: since } } }),
    prisma.workspace.groupBy({ by: ["plan"], _count: { _all: true } }),
    prisma.chatMessage.count({ where: { createdAt: { gte: since } } }),
    prisma.imageGenAsyncResult.count({ where: { createdAt: { gte: since } } }),
    prisma.chatMessage.aggregate({
      where: { createdAt: { gte: since } },
      _sum: { tokens: true },
    }),
    prisma.user.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true },
    }),
    prisma.chatMessage.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true },
    }),
    foundingSpotsSnapshot(),
    prisma.supportThread.count({ where: { status: { in: ["open", "live"] } } }),
    prisma.supportThread.count({ where: { status: "live" } }),
    prisma.workspace.count({ where: { suspended: true } }),
    prisma.processedWebhook.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.funnelEvent.findMany({
      where: { kind: "site_visit", createdAt: { gte: since } },
      select: { path: true },
    }),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: membershipInclude,
    }),
  ]);

  const byPlan: Record<PlanId, number> = { demo: 0, starter: 0, pro: 0, ultra: 0 };
  for (const row of planGroups) byPlan[normalizePlanId(row.plan)] += row._count._all;
  const planMix = (Object.keys(PLANS) as PlanId[]).map((id) => ({
    id,
    name: PLANS[id].name,
    price: PLANS[id].price,
    workspaces: byPlan[id],
  }));

  const seriesMap = new Map<string, PanelDayPoint>(
    eachDay(days, since).map((date) => [date, { date, signups: 0, messages: 0 }]),
  );
  for (const row of signupRows) {
    const point = seriesMap.get(dayKey(row.createdAt));
    if (point) point.signups += 1;
  }
  for (const row of messageRows) {
    const point = seriesMap.get(dayKey(row.createdAt));
    if (point) point.messages += 1;
  }

  const pathCounts = new Map<string, number>();
  for (const row of funnelRows) {
    const path = row.path?.trim() || "/";
    pathCounts.set(path, (pathCounts.get(path) ?? 0) + 1);
  }
  const topPagesTotal = funnelRows.length;
  const topPages = [...pathCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([path, visits]) => ({
      path,
      visits,
      share: topPagesTotal > 0 ? visits / topPagesTotal : 0,
    }));

  return {
    rangeDays: days,
    cards: {
      totalUsers,
      newSignups,
      activePaidPlans: byPlan.starter + byPlan.pro + byPlan.ultra,
      messages,
      images,
      chatCredits: chatCredits._sum.tokens ?? 0,
    },
    series: [...seriesMap.values()],
    planMix,
    alerts: {
      foundingRemaining: founding.remaining,
      foundingTotal: founding.total,
      foundingClaimed: founding.claimed,
      openSupport,
      liveSupport,
      suspendedWorkspaces,
      webhooksLast7d,
    },
    topPages,
    topPagesTotal,
    recentSignups: recentUsers.map((user: PanelUserWithMemberships) => {
      const ws = primaryWorkspace(user.memberships);
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        planName: ws ? planDisplayName(ws.plan) : "—",
        createdAt: user.createdAt.toISOString(),
      };
    }),
  };
}

/* ------------------------------------------------------------------ */
/* Users                                                               */
/* ------------------------------------------------------------------ */

export type PanelUserRow = {
  id: string;
  email: string;
  name: string;
  planName: string;
  planId: PlanId | null;
  suspended: boolean;
  creditsUsed: number;
  creditsBudget: number;
  creditsLeft: number;
  joinedAt: string;
  lastChatActivity: string | null;
  foundingNumber: number | null;
};

export type PanelUsersPayload = {
  rows: PanelUserRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  q: string;
};

export async function getPanelUsers(input: {
  q?: string | null;
  page?: number;
  pageSize?: number;
}): Promise<PanelUsersPayload> {
  const q = input.q?.trim() || "";
  const pageSize = Math.min(50, Math.max(5, input.pageSize ?? 25));
  const where = q
    ? {
        OR: [
          { email: { contains: q, mode: "insensitive" as const } },
          { name: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : undefined;

  const total = await prisma.user.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, input.page ?? 1), totalPages);

  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * pageSize,
    take: pageSize,
    include: membershipInclude,
  });

  const ids = users.map((user: PanelUserWithMemberships) => user.id);
  const activity = ids.length
    ? await prisma.chatConversation.groupBy({
        by: ["userId"],
        where: { userId: { in: ids } },
        _max: { updatedAt: true },
      })
    : [];
  const activityByUser = new Map(
    activity.map(
      (row: { userId: string; _max: { updatedAt: Date | null } }): [
        string,
        string | null,
      ] => [row.userId, row._max.updatedAt?.toISOString() ?? null],
    ),
  );

  return {
    q,
    total,
    page,
    pageSize,
    totalPages,
    rows: users.map((user: PanelUserWithMemberships) => {
      const ws = primaryWorkspace(user.memberships);
      const used = ws?.tokenUsed ?? 0;
      const budget = ws?.tokenBudget ?? 0;
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        planName: ws ? planDisplayName(ws.plan) : "No workspace",
        planId: ws ? normalizePlanId(ws.plan) : null,
        suspended: ws?.suspended ?? false,
        creditsUsed: used,
        creditsBudget: budget,
        creditsLeft: Math.max(0, budget - used),
        joinedAt: user.createdAt.toISOString(),
        lastChatActivity: activityByUser.get(user.id) ?? null,
        foundingNumber: user.assistantFoundingMember
          ? user.assistantFoundingNumber
          : null,
      };
    }),
  };
}

export type PanelUserDetail = {
  id: string;
  email: string;
  name: string;
  language: string;
  joinedAt: string;
  googleLinked: boolean;
  supporter: boolean;
  foundingNumber: number | null;
  inviteCode: string | null;
  workspaces: {
    id: string;
    name: string;
    role: string;
    planName: string;
    planId: PlanId;
    suspended: boolean;
    creditsUsed: number;
    creditsBudget: number;
    creditsLeft: number;
    chatCreditsUsed: number;
    whopMembershipId: string | null;
    createdAt: string;
  }[];
  primaryWorkspaceId: string | null;
  totals: {
    conversations: number;
    messages: number;
    chatCredits: number;
    images: number;
    supportThreads: number;
    openSupportThreads: number;
  };
  recentConversations: {
    id: string;
    title: string;
    messages: number;
    updatedAt: string;
  }[];
  recentImages: {
    id: string;
    prompt: string;
    provider: string;
    model: string;
    shared: boolean;
    createdAt: string;
  }[];
  auditTrail: {
    id: string;
    actorEmail: string;
    action: string;
    targetId: string;
    meta: string;
    createdAt: string;
  }[];
};

export async function getPanelUserDetail(userId: string): Promise<PanelUserDetail | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      memberships: {
        include: {
          workspace: {
            select: {
              id: true,
              name: true,
              plan: true,
              tokenUsed: true,
              tokenBudget: true,
              chatTokenUsed: true,
              suspended: true,
              whopMembershipId: true,
              createdAt: true,
            },
          },
        },
      },
    },
  });
  if (!user) return null;

  const workspaceIds = user.memberships.map((m: PanelMembershipRow) => m.workspace.id);
  const primary = primaryWorkspace(user.memberships);

  const [
    conversations,
    messages,
    chatCredits,
    images,
    supportThreads,
    openSupportThreads,
    recentConversations,
    recentImages,
    auditTrail,
  ] = await Promise.all([
    prisma.chatConversation.count({ where: { userId } }),
    prisma.chatMessage.count({ where: { conversation: { userId } } }),
    prisma.chatMessage.aggregate({
      where: { conversation: { userId } },
      _sum: { tokens: true },
    }),
    prisma.imageGenAsyncResult.count({ where: { userId } }),
    prisma.supportThread.count({ where: { userId } }),
    prisma.supportThread.count({
      where: { userId, status: { in: ["open", "live"] } },
    }),
    prisma.chatConversation.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      take: 10,
      include: { _count: { select: { messages: true } } },
    }),
    prisma.imageGenAsyncResult.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        uuid: true,
        prompt: true,
        provider: true,
        model: true,
        shareToken: true,
        createdAt: true,
      },
    }),
    prisma.adminAuditLog.findMany({
      where: { targetId: { in: [userId, ...workspaceIds] } },
      orderBy: { createdAt: "desc" },
      take: 15,
    }),
  ]);

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    language: user.language,
    joinedAt: user.createdAt.toISOString(),
    googleLinked: Boolean(user.googleId),
    supporter: user.supporter,
    foundingNumber: user.assistantFoundingMember ? user.assistantFoundingNumber : null,
    inviteCode: user.inviteCode,
    workspaces: user.memberships.map((m: PanelMembershipDetailRow) => ({
      id: m.workspace.id,
      name: m.workspace.name,
      role: m.role,
      planName: planDisplayName(m.workspace.plan),
      planId: normalizePlanId(m.workspace.plan),
      suspended: m.workspace.suspended,
      creditsUsed: m.workspace.tokenUsed,
      creditsBudget: m.workspace.tokenBudget,
      creditsLeft: Math.max(0, m.workspace.tokenBudget - m.workspace.tokenUsed),
      chatCreditsUsed: m.workspace.chatTokenUsed,
      whopMembershipId: m.workspace.whopMembershipId,
      createdAt: m.workspace.createdAt.toISOString(),
    })),
    primaryWorkspaceId: primary?.id ?? null,
    totals: {
      conversations,
      messages,
      chatCredits: chatCredits._sum.tokens ?? 0,
      images,
      supportThreads,
      openSupportThreads,
    },
    recentConversations: recentConversations.map(
      (row: {
        id: string;
        title: string;
        updatedAt: Date;
        _count: { messages: number };
      }) => ({
      id: row.id,
      title: row.title,
      messages: row._count.messages,
        updatedAt: row.updatedAt.toISOString(),
      }),
    ),
    recentImages: recentImages.map(
      (row: {
        uuid: string;
        prompt: string;
        provider: string;
        model: string;
        shareToken: string | null;
        createdAt: Date;
      }) => ({
      id: row.uuid,
      prompt: row.prompt,
      provider: row.provider,
      model: row.model,
        shared: Boolean(row.shareToken),
        createdAt: row.createdAt.toISOString(),
      }),
    ),
    auditTrail: auditTrail.map(
      (row: {
        id: string;
        actorEmail: string;
        action: string;
        targetId: string;
        meta: string;
        createdAt: Date;
      }) => ({
        id: row.id,
        actorEmail: row.actorEmail,
        action: row.action,
        targetId: row.targetId,
        meta: row.meta,
        createdAt: row.createdAt.toISOString(),
      }),
    ),
  };
}

/* ------------------------------------------------------------------ */
/* Mutations (every one writes an AdminAuditLog row)                   */
/* ------------------------------------------------------------------ */

async function writePanelAudit(input: {
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

/**
 * Adjust a user's credit budget on their primary workspace. Credits wrap
 * the workspace token budget 1:1 (src/lib/credits.ts), so this moves the
 * budget — never the plan, which stays Whop's source of truth.
 */
export async function panelAdjustCredits(input: {
  actorEmail: string;
  userId: string;
  newBudget: number;
  reason: string;
}): Promise<{ workspaceId: string; previousBudget: number; newBudget: number }> {
  const budget = Math.floor(input.newBudget);
  if (!Number.isFinite(budget) || budget < 1_000 || budget > 5_000_000) {
    throw new Error("Credit budget must be between 1,000 and 5,000,000.");
  }
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    include: membershipInclude,
  });
  if (!user) throw new Error("User not found.");
  const ws = primaryWorkspace(user.memberships);
  if (!ws) throw new Error("User has no workspace to adjust.");

  await prisma.workspace.update({
    where: { id: ws.id },
    data: { tokenBudget: budget },
  });
  await writePanelAudit({
    actorEmail: input.actorEmail,
    action: "adjust_credits",
    targetId: input.userId,
    meta: {
      workspaceId: ws.id,
      previousBudget: ws.tokenBudget,
      newBudget: budget,
      reason: input.reason.trim().slice(0, 240),
    },
  });
  return { workspaceId: ws.id, previousBudget: ws.tokenBudget, newBudget: budget };
}

/** Founding-member total slots. Real setting: the signup claim flow reads it. */
export async function panelSetFoundingSlots(input: {
  actorEmail: string;
  total: number;
}): Promise<{ total: number; claimed: number }> {
  const cfg = await getSiteConfig();
  const total = Math.floor(input.total);
  if (!Number.isFinite(total) || total < cfg.assistantFoundingClaimed || total > 500) {
    throw new Error(
      `Total slots must be between the ${cfg.assistantFoundingClaimed} already claimed and 500.`,
    );
  }
  await prisma.siteConfig.update({
    where: { id: "global" },
    data: { assistantFoundingSlots: total },
  });
  await writePanelAudit({
    actorEmail: input.actorEmail,
    action: "set_founding_slots",
    targetId: "global",
    meta: { previousTotal: cfg.assistantFoundingSlots, newTotal: total },
  });
  return { total, claimed: cfg.assistantFoundingClaimed };
}

/* ------------------------------------------------------------------ */
/* Billing                                                             */
/* ------------------------------------------------------------------ */

export type PanelBilling = {
  plans: {
    id: PlanId;
    name: string;
    price: number;
    tokenBudget: number;
    chatTokenBudget: number;
    seats: number;
    workspaces: number;
    suspended: number;
  }[];
  paidWorkspaces: number;
  founding: { total: number; claimed: number; remaining: number; open: boolean };
  webhooks: { id: string; eventType: string; externalId: string | null; createdAt: string }[];
  supports: {
    id: string;
    email: string;
    amountCents: number;
    currency: string;
    status: string;
    createdAt: string;
  }[];
};

export async function getPanelBilling(): Promise<PanelBilling> {
  const [planGroups, suspendedGroups, founding, webhooks, supports] = await Promise.all([
    prisma.workspace.groupBy({ by: ["plan"], _count: { _all: true } }),
    prisma.workspace.groupBy({
      by: ["plan"],
      where: { suspended: true },
      _count: { _all: true },
    }),
    foundingSpotsSnapshot(),
    prisma.processedWebhook.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, eventType: true, externalId: true, createdAt: true },
    }),
    prisma.brandSupport.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        email: true,
        amountCents: true,
        currency: true,
        status: true,
        createdAt: true,
      },
    }),
  ]);

  const counts: Record<PlanId, number> = { demo: 0, starter: 0, pro: 0, ultra: 0 };
  for (const row of planGroups) counts[normalizePlanId(row.plan)] += row._count._all;
  const suspended: Record<PlanId, number> = { demo: 0, starter: 0, pro: 0, ultra: 0 };
  for (const row of suspendedGroups) {
    suspended[normalizePlanId(row.plan)] += row._count._all;
  }

  return {
    plans: (Object.keys(PLANS) as PlanId[]).map((id) => ({
      id,
      name: PLANS[id].name,
      price: PLANS[id].price,
      tokenBudget: PLANS[id].tokenBudget,
      chatTokenBudget: PLANS[id].chatTokenBudget,
      seats: PLANS[id].seats,
      workspaces: counts[id],
      suspended: suspended[id],
    })),
    paidWorkspaces: counts.starter + counts.pro + counts.ultra,
    founding,
    webhooks: webhooks.map(
      (row: {
        id: string;
        eventType: string;
        externalId: string | null;
        createdAt: Date;
      }) => ({
        id: row.id,
        eventType: row.eventType,
        externalId: row.externalId,
        createdAt: row.createdAt.toISOString(),
      }),
    ),
    supports: supports.map(
      (row: {
        id: string;
        email: string;
        amountCents: number;
        currency: string;
        status: string;
        createdAt: Date;
      }) => ({
        id: row.id,
        email: row.email,
        amountCents: row.amountCents,
        currency: row.currency,
        status: row.status,
        createdAt: row.createdAt.toISOString(),
      }),
    ),
  };
}
