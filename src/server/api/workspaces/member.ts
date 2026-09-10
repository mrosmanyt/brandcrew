import { NextResponse } from "next/server";
import { z } from "zod";
import { requireWorkspaceCapability } from "@/lib/auth";
import { recordApprovalAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";
import {
  WORKSPACE_ROLES,
  canAssignRole,
  parseWorkspaceRole,
} from "@/lib/rbac";

const schema = z.object({
  role: z.enum(WORKSPACE_ROLES),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ workspaceId: string; memberId: string }> },
) {
  try {
    const { workspaceId, memberId } = await context.params;
    const { user, role: actorRole } = await requireWorkspaceCapability(
      workspaceId,
      "manage_roles",
    );
    const body = schema.parse(await request.json());
    const target = await prisma.workspaceMember.findFirst({
      where: { id: memberId, workspaceId },
      include: { user: { select: { email: true, name: true } } },
    });
    if (!target) {
      return NextResponse.json({ error: "Member not found." }, { status: 404 });
    }
    const ownerCount = await prisma.workspaceMember.count({
      where: { workspaceId, role: "owner" },
    });
    const nextRole = parseWorkspaceRole(body.role);
    const allowed = canAssignRole({
      actorRole,
      targetCurrent: parseWorkspaceRole(target.role),
      nextRole,
      ownerCount,
    });
    if (!allowed.ok) {
      return NextResponse.json({ error: allowed.error }, { status: 403 });
    }
    const updated = await prisma.workspaceMember.update({
      where: { id: target.id },
      data: { role: nextRole },
      include: { user: { select: { id: true, email: true, name: true } } },
    });
    await recordApprovalAudit({
      workspaceId,
      actorEmail: user.email,
      actorRole,
      action: "role_change",
      detail: `${user.email} set ${updated.user.email} to ${nextRole} (was ${target.role}).`,
      data: {
        memberId: updated.id,
        previousRole: target.role,
        nextRole,
        targetEmail: updated.user.email,
      },
    });
    return jsonOk({
      member: {
        id: updated.id,
        role: updated.role,
        user: updated.user,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Choose owner, admin, approver, or member." }, { status: 400 });
    }
    return jsonError(error);
  }
}
