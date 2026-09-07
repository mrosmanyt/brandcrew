import { NextResponse } from "next/server";
import { z } from "zod";
import { requireWorkspaceMember } from "@/lib/auth";
import { GENERATE_ACTIONS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";
import { createJobFromChat } from "@/lib/job-runtime";
import { isTeamLaunchIntent } from "@/lib/team-launch";
import { BudgetError } from "@/lib/usage";

const postSchema = z.object({
  agentId: z.string().min(1),
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
    const agentId = url.searchParams.get("agentId") || "";
    if (!agentId) {
      return jsonOk({ messages: [], artifacts: [] });
    }
    const conversation = await prisma.conversation.findFirst({
      where: { workspaceId, agentId },
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
    const message = body.message?.trim() || "Give this agent a job from the Brand Kit.";
    if (isTeamLaunchIntent(message)) {
      return jsonOk({ teamLaunch: true });
    }

    const result = await createJobFromChat({
      workspaceId,
      agentId: body.agentId,
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
        { error: "Choose an agent and write a short job." },
        { status: 400 },
      );
    }
    return jsonError(error);
  }
}
