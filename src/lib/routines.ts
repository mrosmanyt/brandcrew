import { prisma } from "@/lib/db";
import { recordWorkspaceAudit } from "@/lib/audit";
import { gmailCreateDraft } from "@/lib/gmail";
import { getConnectedPlugin } from "@/lib/plugins";
import { createJobFromChat } from "@/lib/job-runtime";
import { parsePlan } from "@/lib/job-playbooks";
import { resetPlaybook } from "@/lib/job-playbooks";
import { asAgentRoleSafe } from "@/lib/routines-pure";
import {
  cadenceLabel,
  computeNextRunAt,
  isScheduleCadence,
  type ScheduleCadence,
} from "@/lib/schedule-cadence";
import { slackPostAllowed, slackPostMessage } from "@/lib/slack";
import type { JobPlaybook } from "@/lib/job-types";

export {
  DEFAULT_ROUTINE_CADENCE,
  asAgentRoleSafe,
  routineDeliveryNote,
  type RoutineDelivery,
} from "@/lib/routines-pure";

export type RoutineDTO = {
  id: string;
  workspaceId: string;
  agentId: string | null;
  skillId: string | null;
  scheduleId: string | null;
  playbookKey: string;
  title: string;
  message: string;
  cadence: string;
  cadenceLabel: string;
  deliverSlack: boolean;
  deliverEmail: boolean;
  slackChannel: string;
  emailTo: string;
  sourceJobId: string | null;
  lastJobId: string | null;
  enabled: boolean;
  createdAt: string;
};

export function serializeRoutine(row: {
  id: string;
  workspaceId: string;
  agentId: string | null;
  skillId: string | null;
  scheduleId: string | null;
  playbookKey: string;
  title: string;
  message: string;
  cadence: string;
  deliverSlack: boolean;
  deliverEmail: boolean;
  slackChannel: string;
  emailTo: string;
  sourceJobId: string | null;
  lastJobId: string | null;
  enabled: boolean;
  createdAt: Date;
}): RoutineDTO {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    agentId: row.agentId,
    skillId: row.skillId,
    scheduleId: row.scheduleId,
    playbookKey: row.playbookKey,
    title: row.title,
    message: row.message,
    cadence: row.cadence,
    cadenceLabel: cadenceLabel(row.cadence),
    deliverSlack: row.deliverSlack,
    deliverEmail: row.deliverEmail,
    slackChannel: row.slackChannel,
    emailTo: row.emailTo,
    sourceJobId: row.sourceJobId,
    lastJobId: row.lastJobId,
    enabled: row.enabled,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function saveRoutineFromJob(input: {
  workspaceId: string;
  jobId: string;
  name?: string;
  cadence?: string;
  deliverSlack?: boolean;
  deliverEmail?: boolean;
  slackChannel?: string;
  emailTo?: string;
}) {
  const job = await prisma.job.findFirst({
    where: { id: input.jobId, workspaceId: input.workspaceId },
  });
  if (!job) throw new Error("Job not found.");
  const cadence: ScheduleCadence = isScheduleCadence(input.cadence || "")
    ? (input.cadence as ScheduleCadence)
    : "weekly_monday";
  const title = (input.name || job.title).trim() || "Saved routine";
  const playbook: JobPlaybook = resetPlaybook({
    key: job.playbookKey || "custom",
    title,
    agentRole: asAgentRoleSafe(job.agentRole),
    steps: parsePlan(job.plan),
  });

  const skill = await prisma.skill.create({
    data: {
      workspaceId: input.workspaceId,
      name: title,
      agentRole: playbook.agentRole,
      agentId: job.agentId,
      playbook: JSON.stringify(playbook),
      sourceJobId: job.id,
    },
  });

  const schedule = job.agentId
    ? await prisma.scheduledJob.create({
        data: {
          workspaceId: input.workspaceId,
          agentId: job.agentId,
          title,
          message: job.prompt,
          playbookKey: playbook.key,
          skillId: skill.id,
          deliverSlack: Boolean(input.deliverSlack),
          deliverEmail: Boolean(input.deliverEmail),
          slackChannel: (input.slackChannel || "").trim(),
          sourceJobId: job.id,
          cadence,
          nextRunAt: computeNextRunAt(cadence),
        },
      })
    : null;

  const routine = await prisma.routine.create({
    data: {
      workspaceId: input.workspaceId,
      agentId: job.agentId,
      skillId: skill.id,
      scheduleId: schedule?.id ?? null,
      playbookKey: playbook.key,
      title,
      message: job.prompt,
      cadence,
      deliverSlack: Boolean(input.deliverSlack),
      deliverEmail: Boolean(input.deliverEmail),
      slackChannel: (input.slackChannel || "").trim(),
      emailTo: (input.emailTo || "").trim(),
      sourceJobId: job.id,
      enabled: true,
    },
  });

  await recordWorkspaceAudit({
    workspaceId: input.workspaceId,
    jobId: job.id,
    actor: "user",
    action: "save_routine",
    detail: `Saved “${title}” as a ${cadenceLabel(cadence)} routine.`,
    data: { routineId: routine.id, skillId: skill.id, scheduleId: schedule?.id },
  });

  return { routine: serializeRoutine(routine), skillId: skill.id, scheduleId: schedule?.id ?? null };
}

export async function listRoutines(workspaceId: string) {
  const rows = await prisma.routine.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    take: 40,
  });
  return rows.map(serializeRoutine);
}

/**
 * The macro "replay" button: re-runs a saved routine on demand, outside its
 * cadence. Goes through the same createJobFromChat pipeline as every other
 * job — the write-gate (approval pause on destructive steps) and budget
 * checks apply exactly as they would to a fresh job, recording once never
 * pre-approves anything on replay.
 */
export async function runRoutineNow(input: { workspaceId: string; routineId: string }) {
  const routine = await prisma.routine.findFirst({
    where: { id: input.routineId, workspaceId: input.workspaceId },
  });
  if (!routine) throw new Error("Routine not found.");
  if (!routine.enabled) throw new Error("This macro is paused. Resume it first.");
  if (!routine.agentId) throw new Error("This macro has no agent to run.");

  const result = await createJobFromChat({
    workspaceId: input.workspaceId,
    agentId: routine.agentId,
    message: routine.message,
    playbookKey: routine.playbookKey || undefined,
    skillId: routine.skillId || undefined,
    routineId: routine.id,
  });

  await prisma.routine.update({
    where: { id: routine.id },
    data: { lastJobId: result.job.id },
  });
  await recordWorkspaceAudit({
    workspaceId: input.workspaceId,
    jobId: result.job.id,
    actor: "user",
    action: "run_routine",
    detail: `Ran macro “${routine.title}” on demand.`,
    data: { routineId: routine.id },
  });

  return { jobId: result.job.id };
}

export async function setRoutineEnabled(input: {
  workspaceId: string;
  routineId: string;
  enabled: boolean;
}) {
  const routine = await prisma.routine.findFirst({
    where: { id: input.routineId, workspaceId: input.workspaceId },
  });
  if (!routine) throw new Error("Routine not found.");
  const row = await prisma.routine.update({
    where: { id: routine.id },
    data: { enabled: input.enabled },
  });
  return serializeRoutine(row);
}

export async function deleteRoutine(input: { workspaceId: string; routineId: string }) {
  const routine = await prisma.routine.findFirst({
    where: { id: input.routineId, workspaceId: input.workspaceId },
  });
  if (!routine) throw new Error("Routine not found.");
  await prisma.routine.delete({ where: { id: routine.id } });
  return { ok: true };
}

/**
 * After a human approved the run: draft to Gmail (never send) and/or Slack.
 * Slack post only when a channel is configured — approval already happened.
 */
export async function deliverRoutineOutput(input: {
  workspaceId: string;
  jobId: string;
}) {
  const job = await prisma.job.findFirst({
    where: { id: input.jobId, workspaceId: input.workspaceId },
    include: { artifacts: { orderBy: { createdAt: "asc" } } },
  });
  if (!job) return { delivered: false, reason: "Job not found." };

  const routine = job.routineId
    ? await prisma.routine.findFirst({ where: { id: job.routineId, workspaceId: input.workspaceId } })
    : null;
  const schedule = !routine
    ? await prisma.scheduledJob.findFirst({
        where: { workspaceId: input.workspaceId, lastJobId: job.id },
      })
    : null;

  const deliverSlack = Boolean(routine?.deliverSlack || schedule?.deliverSlack);
  const deliverEmail = Boolean(routine?.deliverEmail || schedule?.deliverEmail);
  const slackChannel = (routine?.slackChannel || schedule?.slackChannel || "").trim();
  const emailTo = (routine?.emailTo || "").trim();
  if (!deliverSlack && !deliverEmail) {
    return { delivered: false, reason: "No Slack/email delivery on this routine." };
  }

  const approved = job.artifacts.filter((row) => row.status === "approved");
  if (!approved.length) {
    return { delivered: false, reason: "Nothing approved to deliver." };
  }

  const body = approved
    .map((row) => `# ${row.title}\n\n${row.content}`)
    .join("\n\n---\n\n")
    .slice(0, 12_000);
  const subject = approved[0]?.title || job.title;
  const notes: string[] = [];

  if (deliverEmail) {
    const gmail = await getConnectedPlugin(input.workspaceId, "gmail");
    if (!gmail) {
      notes.push("Gmail is not connected — email draft skipped.");
    } else {
      if (!emailTo) {
        notes.push("Gmail draft skipped — set an emailTo on the routine.");
      } else {
        try {
          const draft = await gmailCreateDraft({
            workspaceId: input.workspaceId,
            to: emailTo,
            subject: `[CINEM Pro] ${subject}`,
            body: `${body}\n\n— Draft only. CINEM Pro did not send this.`,
          });
          notes.push(`Gmail draft ${draft.id} created (${draft.subject}). Not sent.`);
        } catch (error) {
          notes.push(`Gmail draft failed: ${error instanceof Error ? error.message : "error"}`);
        }
      }
    }
  }

  if (deliverSlack) {
    const slack = await getConnectedPlugin(input.workspaceId, "slack");
    if (!slack) {
      notes.push("Slack is not connected — Slack deliver skipped.");
    } else if (!slackChannel) {
      notes.push("Slack draft kept on the desk (no channel configured — will not post).");
    } else {
      const steps = parsePlan(job.plan);
      if (!slackPostAllowed(steps, "__deliver__")) {
        notes.push("Slack post blocked: this run has no completed ask_user approval.");
      } else {
        try {
          const posted = await slackPostMessage({
            workspaceId: input.workspaceId,
            channel: slackChannel,
            text: `*${subject}*\n\n${body.slice(0, 3500)}\n\n_Approved on CINEM Pro. Not auto-sent elsewhere._`,
          });
          notes.push(`Posted to Slack ${posted.channel} (ts ${posted.ts}).`);
        } catch (error) {
          notes.push(`Slack post failed: ${error instanceof Error ? error.message : "error"}`);
        }
      }
    }
  }

  await prisma.artifact.create({
    data: {
      workspaceId: input.workspaceId,
      jobId: job.id,
      agentId: job.agentId,
      agentRole: job.agentRole,
      type: "routine_delivery",
      title: `Routine delivery — ${subject}`,
      content: notes.join("\n") || "No delivery ran.",
      status: "draft",
      model: "routine",
      provider: "routine",
    },
  });

  await recordWorkspaceAudit({
    workspaceId: input.workspaceId,
    jobId: job.id,
    actor: "system",
    action: "routine_deliver",
    detail: notes.join(" ") || "Delivery attempted.",
    data: { deliverSlack, deliverEmail, slackChannel },
  });

  return { delivered: true, notes };
}
