import { NextResponse } from "next/server";
import { getCurrentUser, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";
import { assertCanAcceptInvite, normalizeInviteEmail } from "@/lib/invites";
import { serializeWorkspace } from "@/lib/workspace";

async function loadInvite(token: string) {
  return prisma.workspaceInvite.findUnique({
    where: { token },
    include: {
      workspace: { select: { id: true, name: true, plan: true } },
    },
  });
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await context.params;
    const invite = await loadInvite(token);
    if (!invite) {
      return NextResponse.json({ error: "Invite not found." }, { status: 404 });
    }
    const expired = invite.expiresAt.getTime() <= Date.now();
    const user = await getCurrentUser();
    return jsonOk({
      invite: {
        email: invite.email,
        workspaceName: invite.workspace.name,
        workspaceId: invite.workspace.id,
        expiresAt: invite.expiresAt.toISOString(),
        accepted: Boolean(invite.acceptedAt),
        expired,
      },
      signedIn: Boolean(user),
      emailMatches: user ? normalizeInviteEmail(user.email) === invite.email : false,
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await context.params;
    const user = await requireUser();
    const invite = await loadInvite(token);
    if (!invite) {
      return NextResponse.json({ error: "Invite not found." }, { status: 404 });
    }
    if (invite.acceptedAt) {
      return NextResponse.json({ error: "This invite was already used." }, { status: 409 });
    }
    if (invite.expiresAt.getTime() <= Date.now()) {
      return NextResponse.json({ error: "This invite has expired." }, { status: 410 });
    }
    if (normalizeInviteEmail(user.email) !== invite.email) {
      return NextResponse.json(
        { error: `Sign in as ${invite.email} to accept this invite.` },
        { status: 403 },
      );
    }

    const existing = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: invite.workspaceId, userId: user.id } },
    });
    if (existing) {
      await prisma.workspaceInvite.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date() },
      });
      return jsonOk({
        alreadyMember: true,
        workspace: serializeWorkspace(await prisma.workspace.findUniqueOrThrow({
          where: { id: invite.workspaceId },
        })),
      });
    }

    await assertCanAcceptInvite(invite.workspaceId);
    await prisma.$transaction([
      prisma.workspaceMember.create({
        data: {
          workspaceId: invite.workspaceId,
          userId: user.id,
          role: invite.role || "member",
        },
      }),
      prisma.workspaceInvite.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date() },
      }),
    ]);

    return jsonOk({
      alreadyMember: false,
      workspace: serializeWorkspace(
        await prisma.workspace.findUniqueOrThrow({ where: { id: invite.workspaceId } }),
      ),
    });
  } catch (error) {
    return jsonError(error);
  }
}
