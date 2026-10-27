import { NextResponse } from "next/server";
import { requireWorkspaceCapability } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ workspaceId: string; inviteId: string }> },
) {
  try {
    const { workspaceId, inviteId } = await context.params;
    await requireWorkspaceCapability(workspaceId, "invite");
    const invite = await prisma.workspaceInvite.findFirst({
      where: { id: inviteId, workspaceId },
    });
    if (!invite) {
      return NextResponse.json({ error: "Invite not found." }, { status: 404 });
    }
    if (invite.acceptedAt) {
      return NextResponse.json({ error: "That invite was already accepted." }, { status: 400 });
    }
    await prisma.workspaceInvite.delete({ where: { id: invite.id } });
    return jsonOk({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
