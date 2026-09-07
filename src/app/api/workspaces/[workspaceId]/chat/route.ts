import { NextResponse } from "next/server";
import { z } from "zod";
import { requireWorkspaceMember } from "@/lib/auth";
import { CHAT_TARGETS, GENERATE_ACTIONS, JOB_ACTION_MESSAGES } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";
import { createJobFromChat } from "@/lib/job-runtime";
import { BudgetError } from "@/lib/usage";

export const maxDuration = 90;

const postSchema = z.object({
  agentRole: z.enum(CHAT_TARGETS),
  message: z.string().max(4000).optional(),
  action: z.enum(GENERATE_ACTIONS).optional(),
});

export async function GET(
  request: Request,
  context: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const { workspaceId } = await context.params;
    await requireWorkspaceMember(workspaceId);
    const url = new URL(request.url);
    const agentRole = url.searchParams.get("agent") || "writer";
    const conversation = await prisma.conversation.findUnique({
      where: {
        workspaceId_agentRole: { workspaceId, agentRole },
      },
      include: {
        messages: { orderBy: { createdAt: "asc" } },
        artifacts: { orderBy: { createdAt: "desc" }, take: 8 },
      },
    });
    return jsonOk({
      messages: conversation?.messages ?? [],
      artifacts: conversation?.artifacts ?? [],
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
    let agentRole = body.agentRole;
    if (action === "generate_week") agentRole = "writer";
    if (action === "sales_pack" || action === "outreach_from_research") agentRole = "sales";
    if (action === "research_pack" || action === "competitor_scan") agentRole = "researcher";
    if (action === "ad_angles_from_url") agentRole = "ads";

    const message =
      body.message?.trim() ||
      JOB_ACTION_MESSAGES[action] ||
      "Give this employee a job from the Brand Kit.";
    if (!message) {
      return NextResponse.json({ error: "Write a short job." }, { status: 400 });
    }

    const result = await createJobFromChat({
      workspaceId,
      agentRole,
      message,
      action,
    });

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    return jsonOk({
      job: result.job,
      messages: result.messages,
      artifact: result.job.artifacts[0] ?? null,
      demo: result.job.artifacts[0]?.provider === "demo" || !result.job.artifacts.length,
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
      return NextResponse.json(
        { error: "Choose an employee and write a short job." },
        { status: 400 },
      );
    }
    return jsonError(error);
  }
}
