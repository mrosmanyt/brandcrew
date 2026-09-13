import { NextResponse } from "next/server";
import { z } from "zod";
import { requireWorkspaceMember } from "@/lib/auth";
import { GENERATE_ACTIONS, JOB_ACTION_MESSAGES } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";
import { composerAttachmentsSchema } from "@/lib/composer-media";
import { isLightweightDeskQuestion, answerDeskQuestion } from "@/lib/desk-qa";
import { createJobFromChat, kickQueuedJobs } from "@/lib/job-runtime";
import { runDueSchedules } from "@/lib/schedules";
import { runDueEventTriggers } from "@/lib/event-triggers";
import { employeeStatusFromJobs, serializeJob, serializeSkill } from "@/lib/job-serialize";
import { isTeamLaunchIntent } from "@/lib/team-launch";
import { getWorkspaceLimits, serializeLimits } from "@/lib/limits";
import { BudgetError } from "@/lib/usage";

const postSchema = z.object({
  agentId: z.string().min(1).optional(),
  message: z.string().max(4000).optional(),
  playbookKey: z.string().max(80).optional(),
  skillId: z.string().optional(),
  action: z.enum(GENERATE_ACTIONS).optional(),
  attachments: composerAttachmentsSchema,
});

export async function GET(
  _request: Request,
  context: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const { workspaceId } = await context.params;
    await requireWorkspaceMember(workspaceId);
    await runDueSchedules(workspaceId);
    await runDueEventTriggers(workspaceId);
    await kickQueuedJobs(workspaceId);

    const [jobs, skills] = await Promise.all([
      prisma.job.findMany({
        where: { workspaceId },
        orderBy: { createdAt: "desc" },
        take: 40,
        include: {
          events: { orderBy: { createdAt: "asc" }, take: 80 },
          artifacts: { orderBy: { createdAt: "asc" } },
        },
      }),
      prisma.skill.findMany({
        where: { workspaceId },
        orderBy: { createdAt: "desc" },
        take: 40,
      }),
    ]);

    const limits = serializeLimits(await getWorkspaceLimits(workspaceId));
    return jsonOk({
      jobs: jobs.map(serializeJob),
      skills: skills.map(serializeSkill),
      employeeStatus: employeeStatusFromJobs(jobs),
      limits,
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const { workspaceId } = await context.params;
    await requireWorkspaceMember(workspaceId);
    const body = postSchema.parse(await request.json());
    const attachments = body.attachments || [];
    let message = body.message?.trim() || "";
    if (!message && body.action && body.action !== "default") {
      message = JOB_ACTION_MESSAGES[body.action] || "";
    }

    if (isTeamLaunchIntent(message) && !body.skillId) {
      return jsonOk({ teamLaunch: true });
    }

    if (!body.agentId) {
      return NextResponse.json(
        { error: "Create or select an agent first." },
        { status: 400 },
      );
    }
    if (!message && !body.skillId && !attachments.length) {
      return NextResponse.json({ error: "Write a short job for this agent." }, { status: 400 });
    }

    if (
      !body.skillId &&
      isLightweightDeskQuestion({
        message,
        action: body.action ?? "default",
        playbookKey: body.playbookKey,
        skillId: body.skillId,
        attachments,
      })
    ) {
      const qa = await answerDeskQuestion({
        workspaceId,
        agentId: body.agentId,
        message,
        attachments,
      });
      const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
      const limits = serializeLimits(await getWorkspaceLimits(workspaceId));
      return jsonOk({
        ...qa,
        usage: {
          ...limits,
          tokenUsed: workspace?.tokenUsed ?? limits.tokenUsed,
          tokenBudget: workspace?.tokenBudget ?? limits.tokenBudget,
        },
        limits,
      });
    }

    const result = await createJobFromChat({
      workspaceId,
      agentId: body.agentId,
      message: message || "Run the saved skill.",
      playbookKey: body.playbookKey,
      skillId: body.skillId,
      action: body.action ?? "default",
      attachments,
    });

    const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
    const limits = serializeLimits(await getWorkspaceLimits(workspaceId));
    return jsonOk({
      ...result,
      usage: {
        ...limits,
        tokenUsed: workspace?.tokenUsed ?? limits.tokenUsed,
        tokenBudget: workspace?.tokenBudget ?? limits.tokenBudget,
      },
      limits,
    });
  } catch (error) {
    if (error instanceof BudgetError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Choose an agent and write a short job." }, { status: 400 });
    }
    return jsonError(error);
  }
}
