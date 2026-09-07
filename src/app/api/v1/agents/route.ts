import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiKey } from "@/lib/api-keys";
import { DEFAULT_AGENT_NAME } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";
import { serializeAgent } from "@/lib/job-serialize";

const createSchema = z.object({
  name: z.string().max(80).optional(),
  role: z.string().max(80).optional(),
  instructions: z.string().max(8000).optional(),
});

export async function GET(request: Request) {
  try {
    const { workspaceId } = await requireApiKey(request);
    const agents = await prisma.agent.findMany({
      where: { workspaceId, status: { not: "archived" } },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    return jsonOk({ agents: agents.map(serializeAgent) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { workspaceId } = await requireApiKey(request);
    const body = createSchema.parse(await request.json().catch(() => ({})));
    const count = await prisma.agent.count({ where: { workspaceId } });
    const agent = await prisma.agent.create({
      data: {
        workspaceId,
        name: body.name?.trim() || DEFAULT_AGENT_NAME,
        role: body.role?.trim() || "",
        instructions: body.instructions?.trim() || "",
        sortOrder: count,
      },
    });
    return jsonOk({ agent: serializeAgent(agent) }, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Could not create that agent." }, { status: 400 });
    }
    return jsonError(error);
  }
}
