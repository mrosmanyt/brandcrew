import { prisma } from "@/lib/db";
import { createJobFromChat } from "@/lib/job-runtime";
import {
  cadenceLabel,
  computeNextRunAt,
  isScheduleCadence,
} from "@/lib/schedule-cadence";
import { BudgetError } from "@/lib/usage";

export {
  SCHEDULE_CADENCES,
  SCHEDULE_SERVERLESS_NOTE,
  cadenceLabel,
  computeNextRunAt,
  isScheduleCadence,
  type ScheduleCadence,
} from "@/lib/schedule-cadence";

export function serializeSchedule(row: {
  id: string;
  workspaceId: string;
  agentId: string | null;
  title: string;
  message: string;
  playbookKey: string | null;
  cadence: string;
  timezone: string;
  nextRunAt: Date;
  lastRunAt: Date | null;
  lastJobId: string | null;
  skillId?: string | null;
  deliverSlack?: boolean;
  deliverEmail?: boolean;
  slackChannel?: string;
  enabled: boolean;
  createdAt: Date;
}) {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    agentId: row.agentId,
    title: row.title,
    message: row.message,
    playbookKey: row.playbookKey,
    skillId: row.skillId ?? null,
    cadence: row.cadence,
    cadenceLabel: cadenceLabel(row.cadence),
    timezone: row.timezone,
    nextRunAt: row.nextRunAt.toISOString(),
    lastRunAt: row.lastRunAt?.toISOString() ?? null,
    lastJobId: row.lastJobId,
    deliverSlack: Boolean(row.deliverSlack),
    deliverEmail: Boolean(row.deliverEmail),
    slackChannel: row.slackChannel || "",
    enabled: row.enabled,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function runDueSchedules(workspaceId?: string) {
  const now = new Date();
  const due = await prisma.scheduledJob.findMany({
    where: {
      enabled: true,
      nextRunAt: { lte: now },
      ...(workspaceId ? { workspaceId } : {}),
    },
    take: 20,
    orderBy: { nextRunAt: "asc" },
  });

  const started: string[] = [];
  const skipped: { id: string; reason: string }[] = [];

  for (const row of due) {
    if (!row.agentId) {
      skipped.push({ id: row.id, reason: "No agent on this schedule." });
      continue;
    }
    const next = computeNextRunAt(
      isScheduleCadence(row.cadence) ? row.cadence : "weekly_monday",
      now,
    );
    const claimed = await prisma.scheduledJob.updateMany({
      where: {
        id: row.id,
        enabled: true,
        nextRunAt: row.nextRunAt,
      },
      data: {
        lastRunAt: now,
        nextRunAt: next,
      },
    });
    if (claimed.count === 0) continue;

    try {
      const result = await createJobFromChat({
        workspaceId: row.workspaceId,
        agentId: row.agentId,
        message: row.message,
        playbookKey: row.playbookKey || undefined,
        skillId: row.skillId || undefined,
      });
      const routine = row.skillId
        ? await prisma.routine.findFirst({
            where: { workspaceId: row.workspaceId, skillId: row.skillId, enabled: true },
          })
        : await prisma.routine.findFirst({
            where: { workspaceId: row.workspaceId, scheduleId: row.id, enabled: true },
          });
      await prisma.scheduledJob.update({
        where: { id: row.id },
        data: { lastJobId: result.job.id },
      });
      if (routine) {
        await prisma.job.update({
          where: { id: result.job.id },
          data: { routineId: routine.id },
        });
        await prisma.routine.update({
          where: { id: routine.id },
          data: { lastJobId: result.job.id },
        });
      }
      started.push(result.job.id);
    } catch (error) {
      await prisma.scheduledJob.update({
        where: { id: row.id },
        data: {
          nextRunAt: row.nextRunAt,
          lastRunAt: row.lastRunAt,
        },
      });
      const reason =
        error instanceof BudgetError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Could not enqueue scheduled job.";
      skipped.push({ id: row.id, reason });
    }
  }

  return { due: due.length, started: started.length, jobIds: started, skipped };
}
