import { NextResponse } from "next/server";
import { z } from "zod";
import { requireWorkspaceMember } from "@/lib/auth";
import { DEFAULT_AGENT_NAME } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { ClientError, jsonError, jsonOk } from "@/lib/http";
import { serializeAgent } from "@/lib/job-serialize";
import { getMarketplaceBot } from "@/lib/marketplace";

const schema = z.object({
  templateId: z.string().min(1).max(80),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const { workspaceId } = await context.params;
    await requireWorkspaceMember(workspaceId);
    const body = schema.parse(await request.json());
    const bot = getMarketplaceBot(body.templateId);
    if (!bot) throw new ClientError("Unknown bot template.");

    const existing = await prisma.agent.findFirst({
      where: {
        workspaceId,
        templateId: bot.id,
        status: { not: "archived" },
      },
    });
    if (existing) {
      return jsonOk({ agent: serializeAgent(existing), alreadyAdded: true });
    }

    const count = await prisma.agent.count({ where: { workspaceId } });
    const agent = await prisma.agent.create({
      data: {
        workspaceId,
        name: DEFAULT_AGENT_NAME,
        role: bot.role,
        instructions: bot.instructions,
        templateId: bot.id,
        sortOrder: count,
      },
    });
    return jsonOk({ agent: serializeAgent(agent), alreadyAdded: false });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Choose a bot template." }, { status: 400 });
    }
    return jsonError(error);
  }
}
