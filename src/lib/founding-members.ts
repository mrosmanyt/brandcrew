/**
 * First-50 founding members — Cinem AI Assistant free for life.
 * Real DB counter; public spots-left for landing + signup.
 */
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";

export const ASSISTANT_FOUNDING_SLOTS_DEFAULT = 50;

export type FoundingSpotsSnapshot = {
  total: number;
  claimed: number;
  remaining: number;
  open: boolean;
};

function normalizeSlots(raw?: number | null) {
  const n = typeof raw === "number" ? raw : ASSISTANT_FOUNDING_SLOTS_DEFAULT;
  return Math.max(1, Math.min(500, Math.floor(n)));
}

export async function getSiteConfig() {
  const row = await prisma.siteConfig.upsert({
    where: { id: "global" },
    create: {
      id: "global",
      assistantFoundingSlots: ASSISTANT_FOUNDING_SLOTS_DEFAULT,
      assistantFoundingClaimed: 0,
    },
    update: {},
  });
  return row;
}

export async function foundingSpotsSnapshot(): Promise<FoundingSpotsSnapshot> {
  const row = await getSiteConfig();
  const total = normalizeSlots(row.assistantFoundingSlots);
  const claimed = Math.max(0, Math.min(total, row.assistantFoundingClaimed));
  const remaining = Math.max(0, total - claimed);
  return { total, claimed, remaining, open: remaining > 0 };
}

function inviteCode() {
  return randomBytes(5).toString("hex");
}

/** Claim a founding spot for a new user (signup / Google create). Idempotent if already founding. */
export async function claimFoundingMember(userId: string, invitedByCode?: string | null) {
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      assistantFoundingMember: true,
      assistantFoundingNumber: true,
      inviteCode: true,
    },
  });
  if (!existing) return { claimed: false as const, number: null, remaining: 0 };

  if (existing.assistantFoundingMember) {
    const spots = await foundingSpotsSnapshot();
    return {
      claimed: true as const,
      number: existing.assistantFoundingNumber,
      remaining: spots.remaining,
    };
  }

  let inviterId: string | null = null;
  const code = invitedByCode?.trim().toLowerCase();
  if (code) {
    const inviter = await prisma.user.findFirst({
      where: { inviteCode: code },
      select: { id: true },
    });
    inviterId = inviter?.id ?? null;
  }

  const result = await prisma.$transaction(async (tx) => {
    const cfg = await tx.siteConfig.upsert({
      where: { id: "global" },
      create: {
        id: "global",
        assistantFoundingSlots: ASSISTANT_FOUNDING_SLOTS_DEFAULT,
        assistantFoundingClaimed: 0,
      },
      update: {},
    });
    const total = normalizeSlots(cfg.assistantFoundingSlots);
    if (cfg.assistantFoundingClaimed >= total) {
      await tx.user.update({
        where: { id: userId },
        data: { assistantRequiresPaid: true },
      });
      return { claimed: false as const, number: null, remaining: 0 };
    }
    const number = cfg.assistantFoundingClaimed + 1;
    await tx.siteConfig.update({
      where: { id: "global" },
      data: { assistantFoundingClaimed: number },
    });
    let userInvite = existing.inviteCode;
    if (!userInvite) {
      for (let i = 0; i < 5; i++) {
        const candidate = inviteCode();
        const taken = await tx.user.findUnique({ where: { inviteCode: candidate } });
        if (!taken) {
          userInvite = candidate;
          break;
        }
      }
      if (!userInvite) userInvite = inviteCode();
    }
    await tx.user.update({
      where: { id: userId },
      data: {
        assistantFoundingMember: true,
        assistantFoundingNumber: number,
        inviteCode: userInvite,
        invitedByUserId: inviterId,
      },
    });
    return { claimed: true as const, number, remaining: total - number };
  });

  return result;
}

export async function userFoundingBadge(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      assistantFoundingMember: true,
      assistantFoundingNumber: true,
      inviteCode: true,
    },
  });
  if (!user?.assistantFoundingMember) return null;
  return {
    foundingMember: true,
    number: user.assistantFoundingNumber,
    inviteCode: user.inviteCode,
  };
}

/** Founding members on Free plan get assistant included (same as paid). */
export function foundingIncludesAssistant(input: {
  assistantFoundingMember?: boolean;
  plan?: string | null;
}) {
  return Boolean(input.assistantFoundingMember);
}
