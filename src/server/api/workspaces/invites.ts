import { NextResponse } from "next/server";
import { z } from "zod";
import { requireWorkspaceCapability, requireWorkspaceMember } from "@/lib/auth";
import { recordApprovalAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";
import {
  assertSeatAvailable,
  inviteExpiresAt,
  normalizeInviteEmail,
  newInviteToken,
  serializeInvite,
} from "@/lib/invites";
import { parseInviteRole, serializeMembership, WORKSPACE_ROLES } from "@/lib/rbac";

const schema = z.object({
  email: z.string().email(),
  role: z.enum(WORKSPACE_ROLES).optional(),
});

export async function GET(
  _request: Request,
  context: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const { workspaceId } = await context.params;
    const { workspace, member } = await requireWorkspaceMember(workspaceId);
    const [invites, members] = await Promise.all([
      prisma.workspaceInvite.findMany({
        where: { workspaceId },
        orderBy: { createdAt: "desc" },
        take: 40,
      }),
      prisma.workspaceMember.findMany({
        where: { workspaceId },
        include: { user: { select: { id: true, email: true, name: true } } },
      }),
    ]);
    return jsonOk({
      invites: invites.map(serializeInvite),
      members: members.map((row) => ({
        id: row.id,
        role: row.role,
        user: row.user,
      })),
      plan: workspace.plan,
      membership: serializeMembership(member.role),
    });
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
    const { user, role } = await requireWorkspaceCapability(workspaceId, "invite");
    const body = schema.parse(await request.json());
    const email = normalizeInviteEmail(body.email);
    const inviteRole = parseInviteRole(body.role);
    await assertSeatAvailable(workspaceId);

    const existingMember = await prisma.workspaceMember.findFirst({
      where: { workspaceId, user: { email } },
    });
    if (existingMember) {
      return NextResponse.json({ error: "That person is already on this desk." }, { status: 409 });
    }

    const existing = await prisma.workspaceInvite.findFirst({
      where: { workspaceId, email, acceptedAt: null, expiresAt: { gt: new Date() } },
    });
    if (existing) {
      return jsonOk({
        invite: serializeInvite(existing),
        alreadyPending: true,
        emailSent: false,
        emailNote: "No mail provider in this slice — copy the invite link.",
      });
    }

    const invite = await prisma.workspaceInvite.create({
      data: {
        workspaceId,
        email,
        token: newInviteToken(),
        invitedById: user.id,
        role: inviteRole,
        expiresAt: inviteExpiresAt(),
      },
    });
    await recordApprovalAudit({
      workspaceId,
      actorEmail: user.email,
      actorRole: role,
      action: "invite",
      detail: `${user.email} invited ${email} as ${inviteRole}.`,
      data: { email, role: inviteRole },
    });
    return jsonOk({
      invite: serializeInvite(invite),
      alreadyPending: false,
      emailSent: false,
      emailNote: "No mail provider in this slice — copy the invite link and send it yourself.",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
    }
    return jsonError(error);
  }
}
