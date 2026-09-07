import { NextResponse } from "next/server";
import { z } from "zod";
import { requireWorkspaceMember } from "@/lib/auth";
import { AGENT_ROLES } from "@/lib/constants";
import { parseBrandKit } from "@/lib/brand-kit";
import { prisma } from "@/lib/db";
import { generateAgentArtifact } from "@/lib/agents";
import { jsonError, jsonOk } from "@/lib/http";
import { assertWorkspaceBudget, BudgetError, recordUsage } from "@/lib/usage";

const ACTION_MESSAGES = {
  generate_week: "Generate a week of 7 LinkedIn posts from the Brand Kit.",
  sales_pack: "Write a sales pack: 5 emails and 5 LinkedIn DMs.",
  regenerate: "Regenerate the last artifact with the same brief.",
  default: "",
} as const;

const postSchema = z.object({
  agentRole: z.enum(AGENT_ROLES),
  message: z.string().max(4000).optional(),
  action: z
    .enum(["default", "generate_week", "sales_pack", "regenerate"])
    .optional(),
});

export async function GET(
  request: Request,
  context: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const { workspaceId } = await context.params;
    await requireWorkspaceMember(workspaceId);
    const url = new URL(request.url);
    const agentRole = url.searchParams.get("agent") || "strategist";
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
    const { workspace } = await requireWorkspaceMember(workspaceId);
    const body = postSchema.parse(await request.json());
    const action = body.action ?? "default";
    let agentRole = body.agentRole;
    if (action === "generate_week") agentRole = "writer";
    if (action === "sales_pack") agentRole = "sales";

    const message =
      body.message?.trim() ||
      ACTION_MESSAGES[action] ||
      "Generate the day-1 artifact.";
    if (!message) {
      return NextResponse.json({ error: "Write a short request." }, { status: 400 });
    }

    await assertWorkspaceBudget(workspaceId);

    const conversation = await prisma.conversation.upsert({
      where: {
        workspaceId_agentRole: {
          workspaceId,
          agentRole,
        },
      },
      create: { workspaceId, agentRole },
      update: {},
      include: {
        messages: { orderBy: { createdAt: "asc" }, take: 12 },
      },
    });

    const history = conversation.messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

    const result = await generateAgentArtifact({
      role: agentRole,
      kit: parseBrandKit(workspace.brandKit),
      userMessage: message,
      history,
      action,
    });

    const billedTokens = result.demo ? 350 : Math.max(result.tokens, 1);

    const [userMessage, assistantMessage, artifact] = await prisma.$transaction([
      prisma.message.create({
        data: {
          conversationId: conversation.id,
          role: "user",
          content: message,
        },
      }),
      prisma.message.create({
        data: {
          conversationId: conversation.id,
          role: "assistant",
          content: result.assistantText,
        },
      }),
      prisma.artifact.create({
        data: {
          workspaceId,
          conversationId: conversation.id,
          agentRole,
          type: result.artifact.type,
          title: result.artifact.title,
          content: result.artifact.content,
          status: "draft",
          model: result.model,
          provider: result.provider,
        },
      }),
    ]);

    if (result.artifact.calendar?.length) {
      if (agentRole === "distributor") {
        await prisma.calendarItem.deleteMany({ where: { workspaceId } });
      }
      await prisma.calendarItem.createMany({
        data: result.artifact.calendar.map((item) => ({
          workspaceId,
          date: String(item.date),
          channel: String(item.channel || "linkedin"),
          title: String(item.title),
          content: String(item.content || ""),
          artifactId: artifact.id,
        })),
      });
    }

    if (result.artifact.tasks?.length) {
      const existing = await prisma.task.count({ where: { workspaceId } });
      await prisma.task.createMany({
        data: result.artifact.tasks.map((task, index) => ({
          workspaceId,
          artifactId: artifact.id,
          title: String(task.title),
          description: String(task.description || ""),
          status: ["approve", "schedule", "done"].includes(task.status)
            ? task.status
            : "approve",
          sortOrder: existing + index,
        })),
      });
    }

    await recordUsage({
      workspaceId,
      tokens: billedTokens,
      model: result.model,
      agentRole,
    });

    const updated = await prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    return jsonOk({
      messages: [userMessage, assistantMessage],
      artifact,
      demo: result.demo,
      model: result.model,
      provider: result.provider,
      usage: {
        tokenUsed: updated?.tokenUsed ?? workspace.tokenUsed + billedTokens,
        tokenBudget: updated?.tokenBudget ?? workspace.tokenBudget,
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
        { error: "Choose an agent and write a short request." },
        { status: 400 },
      );
    }
    return jsonError(error);
  }
}
