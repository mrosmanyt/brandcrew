import { z } from "zod";
import { createWorkspaceApiKey, serializeApiKey } from "@/lib/api-keys";
import { requireWorkspaceMember } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { jsonError, jsonFail, jsonOk } from "@/lib/http";

const createSchema = z.object({
  name: z.string().max(80).optional(),
});

export async function GET(
  _request: Request,
  context: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const { workspaceId } = await context.params;
    await requireWorkspaceMember(workspaceId);
    const rows = await prisma.apiKey.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
    });
    return jsonOk({ apiKeys: rows.map(serializeApiKey) });
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
    const parsed = createSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return jsonFail("Could not create that key.", 400);
    }
    const created = await createWorkspaceApiKey(workspaceId, parsed.data.name);
    return jsonOk(created, 201);
  } catch (error) {
    return jsonError(error);
  }
}
