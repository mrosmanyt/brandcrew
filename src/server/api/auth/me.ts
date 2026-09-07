import { NextResponse } from "next/server";
import { z } from "zod";
import { accountPatchSchema } from "@/lib/account";
import {
  getCurrentUser,
  hashPassword,
  requireUser,
  verifyPassword,
} from "@/lib/auth";
import { prisma } from "@/lib/db";
import { googleLoginPublicStatus } from "@/lib/google-auth";
import { jsonError, jsonOk } from "@/lib/http";
import { listUserWorkspaces, serializeWorkspace } from "@/lib/workspace";

export async function GET() {
  const user = await getCurrentUser();
  const googleLogin = googleLoginPublicStatus();
  if (!user) {
    return jsonOk({ user: null, workspaces: [], googleLogin });
  }
  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true, googleId: true },
  });
  const workspaces = await listUserWorkspaces(user.id);
  return jsonOk({
    user: {
      ...user,
      hasPassword: Boolean(row?.passwordHash),
      googleLinked: Boolean(row?.googleId),
    },
    workspaces: workspaces.map(serializeWorkspace),
    googleLogin,
  });
}

export async function PATCH(request: Request) {
  try {
    const session = await requireUser();
    const body = accountPatchSchema.parse(await request.json());
    const user = await prisma.user.findUnique({ where: { id: session.id } });
    if (!user) {
      return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
    }
    if (user.passwordHash) {
      if (
        !body.currentPassword ||
        !(await verifyPassword(body.currentPassword, user.passwordHash))
      ) {
        return NextResponse.json(
          { error: "Current password is incorrect." },
          { status: 401 },
        );
      }
    }

    const data: { email?: string; name?: string; passwordHash?: string } = {};
    if (body.email) {
      const email = body.email.toLowerCase().trim();
      const taken = await prisma.user.findFirst({
        where: { email, NOT: { id: user.id } },
      });
      if (taken) {
        return NextResponse.json(
          { error: "That email is already in use." },
          { status: 409 },
        );
      }
      data.email = email;
    }
    if (body.name) data.name = body.name.trim();
    if (body.newPassword) data.passwordHash = await hashPassword(body.newPassword);

    const updated = await prisma.user.update({
      where: { id: user.id },
      data,
    });
    return jsonOk({
      user: { id: updated.id, email: updated.email, name: updated.name },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Email must be valid. New password needs 8+ characters. Password accounts must include the current password." },
        { status: 400 },
      );
    }
    return jsonError(error);
  }
}
