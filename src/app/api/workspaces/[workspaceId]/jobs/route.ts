import { NextResponse } from "next/server";
import { z } from "zod";
import { requireWorkspaceMember } from "@/lib/auth";
import { GENERATE_ACTIONS, JOB_ACTION_MESSAGES } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";
import { createJobFromChat, kickQueuedJobs } from "@/lib/job-runtime";
import { employeeStatusFromJobs, serializeJob, serializeSkill } from "@/lib/job-serialize";
import { isTeamLaunchIntent } from "@/lib/team-launch";
import { BudgetError } from "@/lib/usage";

export const maxDuration = 60;

const postSchema = z.object({
  agentId: z.string().min(1).optional(),
  message: z.string().max(4000).optional(),
  playbookKey: z.string().max(80).optional(),
  skillId: z.string().optional(),
  action: z.enum(GENERATE_ACTIONS).optional(),
});

export async function GET(
  _request: Request,
  context: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const { workspaceId } = await context.params;
    await requireWorkspaceMember(workspaceId);
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

    return jsonOk({
      jobs: jobs.map(serializeJob),
      skills: skills.map(serializeSkill),
      employeeStatus: employeeStatusFromJobs(jobs),
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
    if (!message && !body.skillId) {
      return NextResponse.json({ error: "Write a short job for this agent." }, { status: 400 });
    }

    const result = await createJobFromChat({
      workspaceId,
      agentId: body.agentId,
      message: message || "Run the saved skill.",
      playbookKey: body.playbookKey,
      skillId: body.skillId,
      action: body.action ?? "default",
    });

    const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
    return jsonOk({
      ...result,
      usage: {
        tokenUsed: workspace?.tokenUsed ?? 0,
        tokenBudget: workspace?.tokenBudget ?? 0,
      },
    });
  } catch (error) {
    if (error instanceof BudgetError) {
      return NextResponse.json(
        { error: error.message, code: "BUDGET" },
        { status: error.status },
      );
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Choose an agent and write a short job." }, { status: 400 });
    }
    return jsonError(error);
  }
}
