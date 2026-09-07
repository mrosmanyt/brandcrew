import { NextResponse } from "next/server";
import { serializeApiKey } from "@/lib/api-keys";
import { requireWorkspaceMember } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ workspaceId: string; keyId: string }> },
) {
  try {
    const { workspaceId, keyId } = await context.params;
    await requireWorkspaceMember(workspaceId);
    const existing = await prisma.apiKey.findFirst({
      where: { id: keyId, workspaceId },
    });
    if (!existing) {
      return NextResponse.json({ error: "API key not found." }, { status: 404 });
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
