import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword, setSessionCookie } from "@/lib/auth";
import { limitsForPlan } from "@/lib/limits";
import { createDemoWorkspace } from "@/lib/workspace";
import { honeypotFilled } from "@/lib/form-guard";
import { jsonError } from "@/lib/http";
import { assertPasswordAllowed } from "@/lib/password";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/lib/password-rules";
import { claimFoundingMember, foundingSpotsSnapshot } from "@/lib/founding-members";
import { redeemReferralOnSignup, referralStats } from "@/lib/referral-invites";
import { isSupabaseAuthEnabled } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureAppUser } from "@/lib/supabase/ensure-app-user";

const schema = z.object({
  name: z.string().min(1).max(80),
  email: z.string().email(),
  password: z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH),
  inviteToken: z.string().max(200).optional(),
  /** Viral invite code from a founding member (?invite=abc). */
  memberInvite: z.string().max(40).optional(),
  company_url: z.string().max(200).optional(),
});

async function legacySignup(body: z.infer<typeof schema>) {
  const email = body.email.toLowerCase().trim();
  const weak = await assertPasswordAllowed(body.password, email);
  if (weak) {
    return NextResponse.json({ error: weak }, { status: 400 });
  }
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
  const founding = await claimFoundingMember(user.id, body.memberInvite);
  const referral = await redeemReferralOnSignup(user.id, body.memberInvite);
  const spots = await foundingSpotsSnapshot();
  await setSessionCookie(user.id);
  void import("@/lib/analytics")
    .then((mod) => mod.recordAnonymousAnalytics({ kind: "signup", key: "signup" }))
    .catch(() => undefined);
  return NextResponse.json({
    user: { id: user.id, email: user.email, name: user.name },
    workspaceId,
    joinedViaInvite: Boolean(invite),
    founding: {
      claimed: founding.claimed,
      number: founding.number,
      remaining: spots.remaining,
      open: spots.open,
    },
    referral,
  });
}

export async function POST(request: Request) {
  try {
    const raw: unknown = await request.json();
    if (honeypotFilled(raw)) {
      return NextResponse.json({ error: "Could not complete that request." }, { status: 400 });
    }
    const body = schema.parse(raw);
    const email = body.email.toLowerCase().trim();
    const weak = await assertPasswordAllowed(body.password, email);
    if (weak) {
      return NextResponse.json({ error: weak }, { status: 400 });
    }

    if (!isSupabaseAuthEnabled()) {
      return legacySignup(body);
    }

    const supabase = await createSupabaseServerClient();
    if (!supabase) {
      return NextResponse.json(
        { error: "Supabase Auth is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY." },
        { status: 503 },
      );
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password: body.password,
      options: {
        data: { name: body.name.trim() },
      },
    });
    if (error) {
      const message = error.message || "Could not create the account.";
      const status = /already registered/i.test(message) ? 409 : 400;
      return NextResponse.json({ error: message }, { status });
    }
    if (!data.user) {
      return NextResponse.json({ error: "Could not create the account." }, { status: 500 });
    }

    const ensured = await ensureAppUser(data.user, {
      name: body.name.trim(),
      inviteToken: body.inviteToken,
      memberInvite: body.memberInvite,
      bootstrapNewAccount: true,
    });
    const spots = await foundingSpotsSnapshot();
    const userRow = await prisma.user.findUnique({
      where: { id: ensured.user.id },
      select: {
        assistantFoundingMember: true,
        assistantFoundingNumber: true,
      },
    });
    const founding = {
      claimed: Boolean(userRow?.assistantFoundingMember),
      number: userRow?.assistantFoundingNumber ?? null,
      remaining: spots.remaining,
      open: spots.open,
    };
    const referral = body.memberInvite
      ? { redeemed: (await referralStats(ensured.user.id)).redeemedAsInvitee }
      : { redeemed: false as const, reason: "no_code" as const };

    void import("@/lib/analytics")
      .then((mod) => mod.recordAnonymousAnalytics({ kind: "signup", key: "signup" }))
      .catch(() => undefined);
    return NextResponse.json({
      user: ensured.user,
      workspaceId: ensured.workspaceId,
      joinedViaInvite: ensured.joinedViaInvite,
      founding: {
        claimed: founding.claimed,
        number: founding.number,
        remaining: spots.remaining,
        open: spots.open,
      },
      referral,
      needsEmailConfirmation: !data.session,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Name, a valid email, and a password of 8+ characters (not a common password) are required." },
        { status: 400 },
      );
    }
    return jsonError(error);
  }
}
