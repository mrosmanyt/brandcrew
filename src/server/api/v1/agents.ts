import { z } from "zod";
import { requireApiKey } from "@/lib/api-keys";
import { DEFAULT_AGENT_NAME } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { jsonError, jsonFail, jsonOk } from "@/lib/http";
import { serializeAgent } from "@/lib/job-serialize";

const createSchema = z.object({
  name: z.string().max(80).optional(),
  role: z.string().max(80).optional(),
  instructions: z.string().max(8000).optional(),
  templateId: z.string().max(80).optional(),
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
    const parsed = createSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return jsonFail("Could not create that agent.", 400);
    }
    const body = parsed.data;
    const count = await prisma.agent.count({ where: { workspaceId } });
    const agent = await prisma.agent.create({
      data: {
        workspaceId,
        name: body.name?.trim() || DEFAULT_AGENT_NAME,
        role: body.role?.trim() || "",
        instructions: body.instructions?.trim() || "",
        templateId: body.templateId?.trim() || null,
        sortOrder: count,
      },
    });
    return jsonOk({ agent: serializeAgent(agent) }, 201);
  } catch (error) {
    return jsonError(error);
  }
}
