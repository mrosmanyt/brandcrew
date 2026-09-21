/**
 * Privacy-safe Admin Insights.
 *
 * Storage choice: aggregates only (`AnalyticsEvent`). There is no detail/log
 * table and no AnalyticsWeeklyReport. The 4-week detail-retention job is a
 * documented no-op. Weekly CSV/JSON is built on demand from these rows.
 * Forward-only — no backfill of historical Support / guest / login data.
 *
 * `recordAnalytics` no-ops when `userId` is set and that user has not opted in.
 * Guest / anonymous events omit `userId` and always increment.
 */

import { prisma } from "@/lib/db";
import { normalizePlanId } from "@/lib/limits";
import {
  payloadHasForbiddenAnalyticsKey,
  topicsFromUserText,
} from "@/lib/analytics-privacy";

export type { AnalyticsTopic } from "@/lib/analytics-privacy";

export const ANALYTICS_DETAIL_RETENTION_DAYS = 28;
/** True: we never persist detail rows, so prune is a no-op. */
export const ANALYTICS_NO_DETAIL_TABLE = true;

export const ANALYTICS_KINDS = [
  "login",
  "signup",
  "topic_support",
  "topic_guest",
  "error",
] as const;

export type AnalyticsKind = (typeof ANALYTICS_KINDS)[number];

export type PlanBucket = "demo" | "starter" | "pro" | "ultra" | "guest" | "unknown" | "";

export function utcDay(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function planBucketOf(plan?: string | null): PlanBucket {
  if (!plan) return "unknown";
  if (plan === "guest") return "guest";
  const id = normalizePlanId(plan);
  return id;
}

function clipKey(key: string) {
  return key.trim().slice(0, 80) || "unknown";
}

function clipKind(kind: string) {
  return kind.trim().slice(0, 40) || "unknown";
}

export type RecordAnalyticsInput = {
  kind: AnalyticsKind | string;
  key: string;
  /** When set, look up User.analyticsOptIn and no-op if false. */
  userId?: string | null;
  planBucket?: string | null;
  increment?: number;
};

/**
 * Increment a daily aggregate. Never stores raw text, emails, or user ids.
 * Opted-out users with a `userId` are a no-op. Missing userId = anonymous/guest.
 */
export async function recordAnalytics(input: RecordAnalyticsInput): Promise<{ recorded: boolean }> {
  const increment = Number.isFinite(input.increment) ? Math.max(0, Math.floor(input.increment || 0)) : 1;
  if (increment <= 0) return { recorded: false };
  const kind = clipKind(input.kind);
  const key = clipKey(input.key);
  const planBucket = clipKey(input.planBucket ?? "") || "";
  const userId = input.userId?.trim() || "";

  try {
    if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { analyticsOptIn: true },
      });
      if (!user?.analyticsOptIn) return { recorded: false };
    }

    const day = utcDay();
    await prisma.analyticsEvent.upsert({
      where: {
        day_kind_key_planBucket: { day, kind, key, planBucket },
      },
      create: { day, kind, key, planBucket, count: increment },
      update: { count: { increment } },
    });
    return { recorded: true };
  } catch {
    return { recorded: false };
  }
}

export async function recordAnonymousAnalytics(input: {
  kind: AnalyticsKind | string;
  key: string;
  planBucket?: string | null;
  increment?: number;
}) {
  return recordAnalytics({ ...input, userId: null });
}

async function planBucketForUser(userId: string): Promise<PlanBucket> {
  try {
    const membership = await prisma.workspaceMember.findFirst({
      where: { userId },
      select: { workspace: { select: { plan: true } } },
      orderBy: { workspace: { createdAt: "asc" } },
    });
    return planBucketOf(membership?.workspace.plan);
  } catch {
    return "unknown";
  }
}

/** Support user messages only — never desk Conversation Message. */
export async function recordSupportMessageTopics(input: {
  text: string;
  userId?: string | null;
}) {
  const topics = topicsFromUserText(input.text);
  const userId = input.userId?.trim() || "";
  const planBucket = userId ? await planBucketForUser(userId) : "guest";
  await Promise.all(
    topics.map((topic) =>
      recordAnalytics({
        kind: "topic_support",
        key: topic,
        userId: userId || null,
        planBucket,
      }),
    ),
  );
}

/** Guest chat: anonymous topic counts only. No guest id, no raw text. */
export async function recordGuestChatTopics(text: string) {
  const topics = topicsFromUserText(text);
  await Promise.all(
    topics.map((topic) =>
      recordAnonymousAnalytics({
        kind: "topic_guest",
        key: topic,
        planBucket: "guest",
      }),
    ),
  );
}

/** Server error codes only — never messages or stack traces. */
export async function recordServerErrorCode(code: string) {
  const key = clipKey(code || "internal_error");
  return recordAnonymousAnalytics({ kind: "error", key, planBucket: "" });
}

/**
 * Detail retention (N=4 weeks). No-op: we never write detail rows.
 * Aggregates are kept forever. Hook this from the existing daily cron.
 */
export async function pruneAnalyticsDetails(): Promise<{
  deleted: number;
  skipped: boolean;
  reason: string;
}> {
  return {
    deleted: 0,
    skipped: true,
    reason:
      "No Analytics detail table. Aggregates stay forever. Weekly reports are generated on demand.",
  };
}

export type InsightsCountRow = { key: string; count: number; planBucket?: string };

export type AdminInsightsPayload = {
  section: "insights";
  generatedAt: string;
  forwardOnly: true;
  retention: {
    detailWeeks: number;
    detailTable: false;
    aggregates: "forever";
  };
  optIn: {
    users: number;
  };
  anonymous: {
    accounts: number;
    logins: number;
    signups: number;
    workspacesByPlan: Record<string, number>;
  };
  topics: {
    support: InsightsCountRow[];
    guestChat: InsightsCountRow[];
  };
  errors: InsightsCountRow[];
};

function sumByKey(rows: { key: string; count: number }[]): InsightsCountRow[] {
  const map = new Map<string, number>();
  for (const row of rows) {
    map.set(row.key, (map.get(row.key) || 0) + row.count);
  }
  return [...map.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

export async function getAdminInsights(): Promise<AdminInsightsPayload> {
  const [optInUsers, accounts, planGroups, events] = await Promise.all([
    prisma.user.count({ where: { analyticsOptIn: true } }),
    prisma.user.count(),
    prisma.workspace.groupBy({
      by: ["plan"],
      _count: { _all: true },
    }),
    prisma.analyticsEvent.findMany({
      select: { kind: true, key: true, count: true, planBucket: true },
    }),
  ]);

  const workspacesByPlan: Record<string, number> = {
    demo: 0,
    starter: 0,
    pro: 0,
    ultra: 0,
  };
  for (const row of planGroups) {
    const id = planBucketOf(row.plan) || "unknown";
    workspacesByPlan[id] = (workspacesByPlan[id] || 0) + row._count._all;
  }

  const logins = events.filter((row) => row.kind === "login").reduce((sum, row) => sum + row.count, 0);
  const signups = events.filter((row) => row.kind === "signup").reduce((sum, row) => sum + row.count, 0);

  const payload: AdminInsightsPayload = {
    section: "insights",
    generatedAt: new Date().toISOString(),
    forwardOnly: true,
    retention: {
      detailWeeks: ANALYTICS_DETAIL_RETENTION_DAYS / 7,
      detailTable: false,
      aggregates: "forever",
    },
    optIn: { users: optInUsers },
    anonymous: {
      accounts,
      logins,
      signups,
      workspacesByPlan,
    },
    topics: {
      support: sumByKey(events.filter((row) => row.kind === "topic_support")),
      guestChat: sumByKey(events.filter((row) => row.kind === "topic_guest")),
    },
    errors: sumByKey(events.filter((row) => row.kind === "error")),
  };

  const leak = payloadHasForbiddenAnalyticsKey(payload);
  if (leak) {
    throw new Error(`Insights payload leaked a forbidden key at ${leak}`);
  }
  return payload;
}

export type WeeklyAnalyticsRow = {
  day: string;
  kind: string;
  key: string;
  planBucket: string;
  count: number;
};

export function weeklyRangeUtc(now = new Date()): { from: Date; to: Date } {
  const to = utcDay(now);
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - 6);
  return { from, to };
}

/** On-demand weekly dump from AnalyticsEvent. No Blob, no extra table. */
export async function buildWeeklyAnalyticsReport(now = new Date()): Promise<{
  generatedAt: string;
  from: string;
  to: string;
  rows: WeeklyAnalyticsRow[];
}> {
  const { from, to } = weeklyRangeUtc(now);
  const events = await prisma.analyticsEvent.findMany({
    where: { day: { gte: from, lte: to } },
    orderBy: [{ day: "asc" }, { kind: "asc" }, { key: "asc" }, { planBucket: "asc" }],
    select: { day: true, kind: true, key: true, planBucket: true, count: true },
  });
  const rows: WeeklyAnalyticsRow[] = events.map((row) => ({
    day: row.day.toISOString().slice(0, 10),
    kind: row.kind,
    key: row.key,
    planBucket: row.planBucket,
    count: row.count,
  }));
  const report = {
    generatedAt: now.toISOString(),
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
    rows,
  };
  const leak = payloadHasForbiddenAnalyticsKey(report);
  if (leak) {
    throw new Error(`Weekly report leaked a forbidden key at ${leak}`);
  }
  return report;
}

export function weeklyReportToCsv(report: {
  generatedAt: string;
  from: string;
  to: string;
  rows: WeeklyAnalyticsRow[];
}): string {
  const header = "day,kind,key,planBucket,count";
  const lines = report.rows.map((row) =>
    [row.day, row.kind, row.key, row.planBucket, String(row.count)].join(","),
  );
  return [`# generatedAt=${report.generatedAt}`, `# range=${report.from}/${report.to}`, header, ...lines].join(
    "\n",
  );
}
