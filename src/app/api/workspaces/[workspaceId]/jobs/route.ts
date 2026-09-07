import { NextResponse } from "next/server";
import { z } from "zod";
import { requireWorkspaceMember } from "@/lib/auth";
import { CHAT_TARGETS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";
import { createJobFromChat, kickQueuedJobs } from "@/lib/job-runtime";
import { employeeStatusFromJobs, serializeJob, serializeSkill } from "@/lib/job-serialize";
import { BudgetError } from "@/lib/usage";

export const maxDuration = 60;

const postSchema = z.object({
  agentRole: z.enum(CHAT_TARGETS).optional(),
  message: z.string().max(4000).optional(),
  playbookKey: z.string().max(80).optional(),
  skillId: z.string().optional(),
  action: z
    .enum(["default", "generate_week", "sales_pack", "research_pack", "regenerate"])
    .optional(),
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
    const action = body.action ?? "default";
    let agentRole = body.agentRole ?? "writer";
    if (action === "generate_week") agentRole = "writer";
    if (action === "sales_pack") agentRole = "sales";
    if (action === "research_pack") agentRole = "researcher";

    const message =
      body.message?.trim() ||
      (action === "generate_week"
        ? "Give Maya a LinkedIn-week job: five posts in Brand Kit voice, then pause for my approval."
        : action === "sales_pack"
          ? "Give Sam a sales-pack job: 5 emails and 5 LinkedIn DMs."
          : action === "research_pack"
            ? "Give Omar a research-pack job. Fetch the company website from the Brand Kit."
            : "");
    if (!message && !body.skillId) {
      return NextResponse.json({ error: "Write a short job for the employee." }, { status: 400 });
    }

    const result = await createJobFromChat({
      workspaceId,
      agentRole,
      message: message || "Run the saved skill.",
      playbookKey: body.playbookKey,
      skillId: body.skillId,
      action,
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
      return NextResponse.json({ error: "Choose an employee and write a short job." }, { status: 400 });
    }
    return jsonError(error);
  }
}
