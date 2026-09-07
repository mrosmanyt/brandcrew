import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { ClientError } from "@/lib/http";
import { getWorkspaceLimits, limitsForPlan } from "@/lib/limits";

export const INVITE_TTL_DAYS = 14;

export function newInviteToken() {
  return randomBytes(24).toString("base64url");
}

export function inviteExpiresAt(from = new Date()) {
  return new Date(from.getTime() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
}

export function normalizeInviteEmail(email: string) {
  return email.trim().toLowerCase();
}

export function inviteAcceptPath(token: string) {
  return `/invite/${encodeURIComponent(token)}`;
}

export function inviteAbsoluteUrl(token: string, origin?: string) {
  const base =
    origin?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    process.env.APP_URL?.replace(/\/$/, "") ||
    "http://127.0.0.1:43180";
  return `${base}${inviteAcceptPath(token)}`;
}

export async function assertSeatAvailable(workspaceId: string, extra = 1) {
  const limits = await getWorkspaceLimits(workspaceId);
  const nextUsed = limits.seatUsed + limits.pendingInvites + extra;
  if (nextUsed > limits.seats) {
    const label = limits.paid ? limits.plan : "Demo";
    throw new ClientError(
      `${label} plan includes ${limits.seats} seat${limits.seats === 1 ? "" : "s"}. Upgrade to invite more teammates.`,
      403,
      "SEAT_LIMIT",
    );
  }
}

export async function assertCanAcceptInvite(workspaceId: string) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: { _count: { select: { members: true } } },
  });
  if (!workspace) throw new ClientError("That invite’s workspace is gone.", 404);
  const caps = limitsForPlan(workspace.plan);
  if (workspace._count.members >= caps.seats) {
    throw new ClientError(
      `This workspace is at its ${caps.seats}-seat ${caps.plan} cap. Ask the owner to upgrade.`,
      403,
      "SEAT_LIMIT",
    );
  }
  return workspace;
}

export function serializeInvite(invite: {
  id: string;
  email: string;
  token: string;
  role: string;
  expiresAt: Date;
  acceptedAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: invite.id,
    email: invite.email,
    role: invite.role,
    expiresAt: invite.expiresAt.toISOString(),
    acceptedAt: invite.acceptedAt?.toISOString() ?? null,
    createdAt: invite.createdAt.toISOString(),
    pending: !invite.acceptedAt && invite.expiresAt.getTime() > Date.now(),
    url: inviteAbsoluteUrl(invite.token),
  };
}
