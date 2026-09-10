import { serializeApiKey } from "@/lib/api-keys";
import { requireWorkspaceCapability } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { jsonError, jsonFail, jsonOk } from "@/lib/http";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ workspaceId: string; keyId: string }> },
) {
  try {
    const { workspaceId, keyId } = await context.params;
    await requireWorkspaceCapability(workspaceId, "api_keys");
    const existing = await prisma.apiKey.findFirst({
      where: { id: keyId, workspaceId },
    });
    if (!existing) {
      return jsonFail("API key not found.", 404);
    }
    if (existing.revokedAt) {
      return jsonOk({ apiKey: serializeApiKey(existing) });
    }
    const row = await prisma.apiKey.update({
      where: { id: keyId },
      data: { revokedAt: new Date() },
    });
    return jsonOk({ apiKey: serializeApiKey(row) });
  } catch (error) {
    return jsonError(error);
  }
}
