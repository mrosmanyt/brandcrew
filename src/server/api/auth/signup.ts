import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword, setSessionCookie } from "@/lib/auth";
import { limitsForPlan } from "@/lib/limits";
import { createDemoWorkspace } from "@/lib/workspace";
import { jsonError } from "@/lib/http";

const schema = z.object({
  name: z.string().min(1).max(80),
  email: z.string().email(),
  password: z.string().min(8).max(72),
  inviteToken: z.string().max(200).optional(),
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const email = body.email.toLowerCase().trim();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "An account with that email already exists." },
        { status: 409 },
      );
    }
    const inviteToken = body.inviteToken?.trim();
    const invite = inviteToken
      ? await prisma.workspaceInvite.findUnique({ where: { token: inviteToken } })
      : null;
    if (inviteToken) {
      if (!invite) {
        return NextResponse.json({ error: "That invite link is not valid." }, { status: 404 });
      }
      if (invite.email !== email) {
        return NextResponse.json(
          { error: `This invite is for ${invite.email}. Use that email to join.` },
          { status: 403 },
        );
      }
      if (invite.acceptedAt || invite.expiresAt.getTime() <= Date.now()) {
        return NextResponse.json({ error: "This invite is no longer valid." }, { status: 410 });
      }
    }
    const user = await prisma.user.create({
      data: {
        name: body.name.trim(),
        email,
        passwordHash: await hashPassword(body.password),
      },
    });
    let workspaceId: string;
    if (invite) {
      const members = await prisma.workspaceMember.count({
        where: { workspaceId: invite.workspaceId },
      });
      const workspace = await prisma.workspace.findUnique({ where: { id: invite.workspaceId } });
      const caps = limitsForPlan(workspace?.plan);
      if (members >= caps.seats) {
        await prisma.user.delete({ where: { id: user.id } }).catch(() => undefined);
        return NextResponse.json(
          { error: `This workspace is at its ${caps.seats}-seat cap.` },
          { status: 403 },
        );
      }
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
      workspaceId = invite.workspaceId;
    } else {
      const workspace = await createDemoWorkspace(user.id);
      workspaceId = workspace.id;
    }
    await setSessionCookie(user.id);
    return NextResponse.json({
      user: { id: user.id, email: user.email, name: user.name },
      workspaceId,
      joinedViaInvite: Boolean(invite),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Name, a valid email, and an 8+ character password are required." },
        { status: 400 },
      );
    }
    return jsonError(error);
  }
}
