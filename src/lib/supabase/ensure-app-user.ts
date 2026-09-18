/**
 * Map Supabase auth.users → Prisma User + profiles row on first login.
 * Founding / invite / workspace setup stay server-authoritative.
 */
import type { User as SupabaseAuthUser } from "@supabase/supabase-js";
import { prisma } from "@/lib/db";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { limitsForPlan } from "@/lib/limits";
import { assertCanAcceptInvite, normalizeInviteEmail } from "@/lib/invites";
import { createDemoWorkspace } from "@/lib/workspace";
import { claimFoundingMember } from "@/lib/founding-members";
import { redeemReferralOnSignup } from "@/lib/referral-invites";
import { ClientError } from "@/lib/http";

export type EnsureAppUserOptions = {
  name?: string;
  inviteToken?: string | null;
  memberInvite?: string | null;
  /** When true, run founding + referral redemption (new signups). */
  bootstrapNewAccount?: boolean;
};

export type EnsureAppUserResult = {
  user: { id: string; email: string; name: string };
  created: boolean;
  workspaceId: string | null;
  joinedViaInvite: boolean;
};

function displayName(authUser: SupabaseAuthUser, override?: string) {
  const meta = authUser.user_metadata ?? {};
  const fromMeta =
    (typeof meta.name === "string" && meta.name) ||
    (typeof meta.full_name === "string" && meta.full_name) ||
    "";
  const email = authUser.email?.toLowerCase().trim() || "";
  const fallback = email.split("@")[0] || "User";
  return (override || fromMeta || fallback).trim().slice(0, 80) || fallback;
}

async function syncProfileRow(input: {
  id: string;
  email: string;
  name: string;
  language?: string | null;
  preferredMode?: string | null;
}) {
  const admin = createSupabaseAdminClient();
  if (!admin) return;
  await admin.from("profiles").upsert(
    {
      id: input.id,
      email: input.email,
      name: input.name,
      language: input.language || "en",
      preferred_mode: input.preferredMode || "desk",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
}

export async function ensureAppUser(
  authUser: SupabaseAuthUser,
  options: EnsureAppUserOptions = {},
): Promise<EnsureAppUserResult> {
  const email = authUser.email?.toLowerCase().trim();
  if (!email) {
    throw new ClientError("That account has no email. Use another sign-in method.", 400);
  }

  const name = displayName(authUser, options.name);
  const inviteToken = options.inviteToken?.trim();
  let invite = inviteToken
    ? await prisma.workspaceInvite.findUnique({ where: { token: inviteToken } })
    : null;

  if (inviteToken) {
    if (!invite) {
      throw new ClientError("That invite link is not valid.", 404);
    }
    if (normalizeInviteEmail(email) !== invite.email) {
      throw new ClientError(
        `This invite is for ${invite.email}. Use that email to join.`,
        403,
      );
    }
    if (invite.acceptedAt || invite.expiresAt.getTime() <= Date.now()) {
      throw new ClientError("This invite is no longer valid.", 410);
    }
  }

  const existing = await prisma.user.findUnique({ where: { id: authUser.id } });
  const created = !existing;

  let user = existing;
  if (!user) {
    const byEmail = await prisma.user.findUnique({ where: { email } });
    if (byEmail && byEmail.id !== authUser.id) {
      throw new ClientError(
        "An account with that email already exists under a different sign-in. Contact support.",
        409,
      );
    }
    user = await prisma.user.create({
      data: {
        id: authUser.id,
        email,
        name,
      },
    });
  } else if (user.name !== name && name) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { name },
    });
  }

  let workspaceId: string | null = null;
  let joinedViaInvite = false;

  if (invite) {
    const members = await prisma.workspaceMember.count({
      where: { workspaceId: invite.workspaceId },
    });
    const workspace = await prisma.workspace.findUnique({
      where: { id: invite.workspaceId },
    });
    const caps = limitsForPlan(workspace?.plan);
    if (members >= caps.seats) {
      if (created) {
        await prisma.user.delete({ where: { id: user.id } }).catch(() => undefined);
      }
      throw new ClientError(
        `This workspace is at its ${caps.seats}-seat cap.`,
        403,
      );
    }
    const member = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: invite.workspaceId, userId: user.id } },
    });
    if (!member) {
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
    } else {
      await prisma.workspaceInvite.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date() },
      });
    }
    workspaceId = invite.workspaceId;
    joinedViaInvite = true;
  } else {
    const memberships = await prisma.workspaceMember.count({
      where: { userId: user.id },
    });
    if (memberships === 0) {
      const workspace = await createDemoWorkspace(user.id);
      workspaceId = workspace.id;
    }
  }

  if (options.bootstrapNewAccount && created) {
    await claimFoundingMember(user.id, options.memberInvite);
    await redeemReferralOnSignup(user.id, options.memberInvite);
  }

  await syncProfileRow({
    id: user.id,
    email: user.email,
    name: user.name,
    language: user.language,
    preferredMode: user.preferredMode,
  });

  return {
    user: { id: user.id, email: user.email, name: user.name },
    created,
    workspaceId,
    joinedViaInvite,
  };
}
