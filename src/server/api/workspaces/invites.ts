import { NextResponse } from "next/server";
import { z } from "zod";
import { requireWorkspaceMember } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";
import {
  assertSeatAvailable,
  inviteExpiresAt,
  normalizeInviteEmail,
  newInviteToken,
  serializeInvite,
} from "@/lib/invites";

const schema = z.object({
  email: z.string().email(),
});

export async function GET(
  _request: Request,
  context: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const { workspaceId } = await context.params;
    const { workspace } = await requireWorkspaceMember(workspaceId);
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
    const { user } = await requireWorkspaceMember(workspaceId);
    const body = schema.parse(await request.json());
    const email = normalizeInviteEmail(body.email);
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
        expiresAt: inviteExpiresAt(),
      },
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
