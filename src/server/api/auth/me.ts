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
import { isSupabaseAuthEnabled } from "@/lib/supabase/env";
import { supabaseGooglePublicStatus } from "@/lib/supabase/oauth";
import { jsonError, jsonOk } from "@/lib/http";
import { isAdminEmail } from "@/lib/admin";
import { assertPasswordAllowed } from "@/lib/password";
import { entitlementFromWorkspaces } from "@/lib/cinem-ai-assistant";
import { listUserWorkspaces, serializeWorkspace } from "@/lib/workspace";
import { withNativeCors } from "@/lib/auth-native";
import { userFoundingBadge } from "@/lib/founding-members";
import { readByokSnapshot } from "@/lib/user-provider-keys";

export async function GET() {
  try {
    const user = await getCurrentUser();
    const googleLogin = isSupabaseAuthEnabled()
      ? supabaseGooglePublicStatus()
      : googleLoginPublicStatus();
    if (!user) {
      return withNativeCors(jsonOk({ user: null, workspaces: [], googleLogin }));
    }
    const row = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        passwordHash: true,
        googleId: true,
        supporter: true,
        assistantFoundingMember: true,
        assistantFoundingNumber: true,
        inviteCode: true,
        analyticsOptIn: true,
      },
    });
    const workspaces = await listUserWorkspaces(user.id);
    const entitlement = entitlementFromWorkspaces(
      workspaces.map((workspace) => ({ id: workspace.id, plan: workspace.plan })),
      { assistantFoundingMember: row?.assistantFoundingMember },
    );
    const founding = await userFoundingBadge(user.id);
    const byok = await readByokSnapshot(user.id).catch(() => null);
    return withNativeCors(
      jsonOk({
        user: {
          ...user,
          hasPassword: Boolean(row?.passwordHash),
          googleLinked: Boolean(row?.googleId),
          isAdmin: isAdminEmail(user.email),
          supporter: Boolean(row?.supporter),
          assistantFoundingMember: Boolean(row?.assistantFoundingMember),
          assistantFoundingNumber: row?.assistantFoundingNumber ?? null,
          inviteCode: row?.inviteCode ?? null,
          analyticsOptIn: Boolean(row?.analyticsOptIn),
        },
        workspaces: workspaces.map(serializeWorkspace),
        plan: entitlement.plan,
        planName: entitlement.planName,
        includedWithPlan: entitlement.includedWithPlan,
        foundingMember: entitlement.foundingMember,
        workspaceId: entitlement.workspaceId,
        founding,
        byok,
        googleLogin,
      }),
    );
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireUser();
    const body = accountPatchSchema.parse(await request.json());
    const user = await prisma.user.findUnique({ where: { id: session.id } });
    if (!user) {
      return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
    }
    const preferenceOnly =
      typeof body.analyticsOptIn === "boolean" && !body.email && !body.name && !body.newPassword;

    if (user.passwordHash && !preferenceOnly) {
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

    const data: {
      email?: string;
      name?: string;
      passwordHash?: string;
      analyticsOptIn?: boolean;
      analyticsOptedAt?: Date | null;
    } = {};
    if (typeof body.analyticsOptIn === "boolean") {
      data.analyticsOptIn = body.analyticsOptIn;
      data.analyticsOptedAt = body.analyticsOptIn ? new Date() : null;
    }
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
    if (body.newPassword) {
      const weak = await assertPasswordAllowed(body.newPassword, data.email || user.email);
      if (weak) {
        return NextResponse.json({ error: weak }, { status: 400 });
      }
      data.passwordHash = await hashPassword(body.newPassword);
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data,
    });
    return jsonOk({
      user: {
        id: updated.id,
        email: updated.email,
        name: updated.name,
        analyticsOptIn: updated.analyticsOptIn,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Email must be valid. New password needs 8+ characters and cannot be a common password. Password accounts must include the current password." },
        { status: 400 },
      );
    }
    return jsonError(error);
  }
}
