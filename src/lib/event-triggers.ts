import { prisma } from "@/lib/db";
import { createJobFromChat } from "@/lib/job-runtime";
import { gmailListRecent } from "@/lib/gmail";
import { getConnectedPlugin } from "@/lib/plugins";
import { BudgetError } from "@/lib/usage";
import { computeNextRunAt, isScheduleCadence } from "@/lib/schedule-cadence";
import { defaultPlaybookForKind, noteForKind } from "@/lib/event-triggers-pure";

/**
 * Cheap event triggers — no extra worker fleet.
 * - schedule: persists an EventTrigger that is also a ScheduledJob (desk load + /api/cron/jobs).
 * - email: polls Connected Gmail for new matching messages, then starts a job.
 * - slack: inbound fire (mention text POSTed here) starts a job. No Events API infra.
 */

export type EventTriggerKind = "email" | "slack" | "schedule" | "webhook";

export type TriggerConfig = {
  query?: string;
  playbookKey?: string;
  agentId?: string;
  secret?: string;
  keyword?: string;
};

export function parseTriggerConfig(raw: string | null | undefined): TriggerConfig {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as TriggerConfig;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function serializeTrigger(row: {
  id: string;
  workspaceId: string;
  kind: string;
  enabled: boolean;
  playbookKey: string;
  agentId: string | null;
  config: string;
  note: string;
  cursor: string;
  lastFiredAt: Date | null;
  lastJobId: string | null;
  createdAt: Date;
}) {
  const config = parseTriggerConfig(row.config);
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    kind: row.kind,
    enabled: row.enabled,
    playbookKey: row.playbookKey,
    agentId: row.agentId,
    config: { query: config.query, keyword: config.keyword, playbookKey: config.playbookKey },
    note: row.note,
    cursor: row.cursor,
    lastFiredAt: row.lastFiredAt?.toISOString() ?? null,
    lastJobId: row.lastJobId,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function upsertEventTrigger(input: {
  workspaceId: string;
  kind: EventTriggerKind;
  enabled?: boolean;
  playbookKey?: string;
  agentId?: string | null;
  query?: string;
  keyword?: string;
  secret?: string;
  note?: string;
}) {
  const existing = await prisma.eventTrigger.findFirst({
    where: { workspaceId: input.workspaceId, kind: input.kind },
    orderBy: { createdAt: "asc" },
  });
  const config: TriggerConfig = {
    query: input.query,
    keyword: input.keyword,
    playbookKey: input.playbookKey,
    agentId: input.agentId || undefined,
    secret: input.secret,
  };
  const data = {
    kind: input.kind,
    enabled: input.enabled ?? true,
    playbookKey: input.playbookKey || defaultPlaybookForKind(input.kind),
    agentId: input.agentId || null,
    config: JSON.stringify(config),
    note: input.note || noteForKind(input.kind),
  };
  const row = existing
    ? await prisma.eventTrigger.update({ where: { id: existing.id }, data })
    : await prisma.eventTrigger.create({
        data: { workspaceId: input.workspaceId, ...data },
      });

  if (input.kind === "schedule" && data.enabled && row.agentId) {
    const cadence = "weekly_monday";
    const already = await prisma.scheduledJob.findFirst({
      where: { workspaceId: input.workspaceId, playbookKey: row.playbookKey, enabled: true },
    });
    if (!already) {
      await prisma.scheduledJob.create({
        data: {
          workspaceId: input.workspaceId,
          agentId: row.agentId,
          title: "Weekly client brief (event trigger)",
          message: "Weekly client brief from the Brand Kit site. Do not invent results.",
          playbookKey: row.playbookKey || "weekly_client_brief",
          cadence,
          nextRunAt: computeNextRunAt(isScheduleCadence(cadence) ? cadence : "weekly_monday"),
        },
      });
    }
  }

  return serializeTrigger(row);
}

export { defaultPlaybookForKind, noteForKind } from "@/lib/event-triggers-pure";

export async function fireTrigger(input: {
  workspaceId: string;
  kind: EventTriggerKind;
  text?: string;
  secret?: string;
  agentId?: string;
}) {
  const row = await prisma.eventTrigger.findFirst({
    where: { workspaceId: input.workspaceId, kind: input.kind, enabled: true },
  });
  if (!row) throw new Error("No enabled trigger of that kind.");
  const config = parseTriggerConfig(row.config);
  if (config.secret && input.secret !== config.secret) {
    throw new Error("Trigger secret does not match.");
  }
  const agentId = input.agentId || row.agentId || config.agentId;
  if (!agentId) throw new Error("This trigger needs an agent.");
  const message =
    input.text?.trim() ||
    (input.kind === "email"
      ? "New matching email received. Draft a reply. Do not send."
      : input.kind === "slack"
        ? "Slack mention received. Draft a reply. Do not post until approved."
        : "Scheduled trigger. Run the playbook.");
  const result = await createJobFromChat({
    workspaceId: input.workspaceId,
    agentId,
    message,
    playbookKey: row.playbookKey || config.playbookKey || defaultPlaybookForKind(input.kind),
  });
  await prisma.eventTrigger.update({
    where: { id: row.id },
    data: { lastFiredAt: new Date(), lastJobId: result.job.id, cursor: result.job.id },
  });
  return result;
}

export async function runDueEventTriggers(workspaceId?: string) {
  const started: string[] = [];
  const skipped: { id: string; reason: string }[] = [];
  const where = {
    enabled: true,
    kind: { in: ["email", "schedule"] },
    ...(workspaceId ? { workspaceId } : {}),
  };
  const rows = await prisma.eventTrigger.findMany({
    where,
    take: 20,
    orderBy: { updatedAt: "asc" },
  });

  for (const row of rows) {
    if (row.kind === "schedule") {
      // ScheduledJob + runDueSchedules is the runner. This row is the catalog flag.
      continue;
    }
    if (row.kind !== "email") continue;
    if (!row.agentId) {
      skipped.push({ id: row.id, reason: "Email trigger has no agent." });
      continue;
    }
    const gmail = await getConnectedPlugin(row.workspaceId, "gmail");
    if (!gmail) {
      skipped.push({ id: row.id, reason: "Gmail is not connected." });
      continue;
    }
    const config = parseTriggerConfig(row.config);
    try {
      const messages = await gmailListRecent({
        workspaceId: row.workspaceId,
        max: 5,
        query: config.query || "in:inbox newer_than:1d",
      });
      const unseen = messages.filter((msg) => msg.id && msg.id !== row.cursor);
      if (!unseen.length) continue;
      const newest = unseen[0];
      const result = await createJobFromChat({
        workspaceId: row.workspaceId,
        agentId: row.agentId,
        message: `New email from ${newest.from}: ${newest.subject}. Draft a reply. Do not send.`,
        playbookKey: row.playbookKey || "inbox_replies",
      });
      await prisma.eventTrigger.update({
        where: { id: row.id },
        data: {
          cursor: newest.id,
          lastFiredAt: new Date(),
          lastJobId: result.job.id,
        },
      });
      started.push(result.job.id);
    } catch (error) {
      const reason =
        error instanceof BudgetError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Email trigger failed.";
      skipped.push({ id: row.id, reason });
    }
  }

  return { checked: rows.length, started: started.length, jobIds: started, skipped };
}
