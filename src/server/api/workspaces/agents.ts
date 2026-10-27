import { NextResponse } from "next/server";
import { z } from "zod";
import { requireWorkspaceMember } from "@/lib/auth";
import { DEFAULT_AGENT_NAME } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";
import { serializeAgent } from "@/lib/job-serialize";
import { serializeAllowedTools } from "@/lib/companions";

const createSchema = z.object({
  name: z.string().max(80).optional(),
  role: z.string().max(80).optional(),
  instructions: z.string().max(8000).optional(),
  templateId: z.string().max(80).optional(),
  allowedTools: z.array(z.string().max(40)).max(24).optional(),
});

export async function GET(
  _request: Request,
  context: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const { workspaceId } = await context.params;
    await requireWorkspaceMember(workspaceId);
    const agents = await prisma.agent.findMany({
      where: { workspaceId, status: { not: "archived" } },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    return jsonOk({ agents: agents.map(serializeAgent) });
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
    const body = createSchema.parse(await request.json().catch(() => ({})));
    const count = await prisma.agent.count({ where: { workspaceId } });
    const agent = await prisma.agent.create({
      data: {
        workspaceId,
        name: body.name?.trim() || DEFAULT_AGENT_NAME,
        role: body.role?.trim() || "",
        instructions: body.instructions?.trim() || "",
        templateId: body.templateId?.trim() || null,
        allowedTools: body.allowedTools ? serializeAllowedTools(body.allowedTools) : "[]",
        sortOrder: count,
      },
    });
    return jsonOk({ agent: serializeAgent(agent) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Could not create that agent." }, { status: 400 });
    }
    return jsonError(error);
  }
}
