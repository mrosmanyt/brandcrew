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
import { jsonError, jsonOk } from "@/lib/http";
import { listUserWorkspaces, serializeWorkspace } from "@/lib/workspace";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return jsonOk({ user: null, workspaces: [] });
  }
  const workspaces = await listUserWorkspaces(user.id);
  return jsonOk({
    user,
    workspaces: workspaces.map(serializeWorkspace),
  });
}

export async function PATCH(request: Request) {
  try {
    const session = await requireUser();
    const body = accountPatchSchema.parse(await request.json());
    const user = await prisma.user.findUnique({ where: { id: session.id } });
    if (!user || !(await verifyPassword(body.currentPassword, user.passwordHash))) {
      return NextResponse.json(
        { error: "Current password is incorrect." },
        { status: 401 },
      );
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
        { error: "Current password is required. Email must be valid. New password needs 8+ characters." },
        { status: 400 },
      );
    }
    return jsonError(error);
  }
}
