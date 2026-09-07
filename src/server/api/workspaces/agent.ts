import { NextResponse } from "next/server";
import { z } from "zod";
import { requireWorkspaceMember } from "@/lib/auth";
import { DEFAULT_AGENT_NAME } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";
import { serializeAgent } from "@/lib/job-serialize";

const patchSchema = z.object({
  name: z.string().max(80).optional(),
  role: z.string().max(80).optional(),
  instructions: z.string().max(8000).optional(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ workspaceId: string; agentId: string }> },
) {
  try {
    const { workspaceId, agentId } = await context.params;
    await requireWorkspaceMember(workspaceId);
    const body = patchSchema.parse(await request.json());
    const existing = await prisma.agent.findFirst({
      where: { id: agentId, workspaceId, status: { not: "archived" } },
    });
    if (!existing) {
      return NextResponse.json({ error: "Agent not found." }, { status: 404 });
    }
    const agent = await prisma.agent.update({
      where: { id: agentId },
      data: {
        name:
          body.name !== undefined ? body.name.trim() || DEFAULT_AGENT_NAME : undefined,
        role: body.role !== undefined ? body.role.trim() : undefined,
        instructions:
          body.instructions !== undefined ? body.instructions.trim() : undefined,
      },
    });
    return jsonOk({ agent: serializeAgent(agent) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Could not update that agent." }, { status: 400 });
    }
    return jsonError(error);
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ workspaceId: string; agentId: string }> },
) {
  try {
    const { workspaceId, agentId } = await context.params;
    await requireWorkspaceMember(workspaceId);
    const existing = await prisma.agent.findFirst({
      where: { id: agentId, workspaceId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Agent not found." }, { status: 404 });
    }
    await prisma.agent.update({
      where: { id: agentId },
      data: { status: "archived" },
    });
    return jsonOk({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
