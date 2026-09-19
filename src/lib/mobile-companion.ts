/**
 * Mobile companion — pair code / deep link + short-lived command tokens.
 */
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { createJobFromChat } from "@/lib/job-runtime";
import { hashCompanionToken } from "@/lib/referral-invites";
import { siteOrigin } from "@/lib/site";

export const COMPANION_PAIR_TTL_MS = 15 * 60 * 1000;
export const COMPANION_COMMAND_TOKEN_PREFIX = "cinem_mcp_";

function pairCode() {
  return randomBytes(3).toString("hex").toUpperCase();
}

function commandToken() {
  return `${COMPANION_COMMAND_TOKEN_PREFIX}${randomBytes(18).toString("hex")}`;
}

export async function createCompanionPair(input: {
  userId: string;
  workspaceId: string;
}) {
  const expiresAt = new Date(Date.now() + COMPANION_PAIR_TTL_MS);
  const token = commandToken();
  const tokenHash = hashCompanionToken(token);

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = pairCode();
    try {
      const row = await prisma.mobileCompanionPair.create({
        data: {
          userId: input.userId,
          workspaceId: input.workspaceId,
          pairCode: code,
          commandTokenHash: tokenHash,
          status: "pending",
          expiresAt,
        },
      });
      const origin = siteOrigin().replace(/\/$/, "");
      return {
        pairId: row.id,
        pairCode: code,
        commandToken: token,
        expiresAt: expiresAt.toISOString(),
        pairUrl: `${origin}/companion/pair?code=${encodeURIComponent(code)}`,
        deepLink: `cinem-pro://companion?code=${encodeURIComponent(code)}`,
        qrUrl: `${origin}/companion/pair?code=${encodeURIComponent(code)}&qr=1`,
      };
    } catch {
      /* pairCode collision — retry */
    }
  }
  throw new Error("Could not create a pairing code. Try again.");
}

export async function claimCompanionPair(input: { userId: string; pairCode: string }) {
  const code = input.pairCode.trim().toUpperCase();
  const row = await prisma.mobileCompanionPair.findUnique({ where: { pairCode: code } });
  if (!row) return { ok: false as const, error: "Invalid pairing code." };
  if (row.expiresAt.getTime() <= Date.now()) {
    await prisma.mobileCompanionPair.update({
      where: { id: row.id },
      data: { status: "expired" },
    });
    return { ok: false as const, error: "That pairing code expired. Generate a new one on desktop." };
  }
  if (row.userId !== input.userId) {
    return { ok: false as const, error: "Sign in as the same CINEM Pro account that generated the code." };
  }
  const updated = await prisma.mobileCompanionPair.update({
    where: { id: row.id },
    data: { status: "active", claimedAt: new Date() },
  });
  return { ok: true as const, pair: updated };
}

export async function resolveCompanionToken(rawToken: string) {
  const token = rawToken.trim();
  if (!token.startsWith(COMPANION_COMMAND_TOKEN_PREFIX)) return null;
  const hash = hashCompanionToken(token);
  const row = await prisma.mobileCompanionPair.findUnique({
    where: { commandTokenHash: hash },
  });
  if (!row || row.status !== "active" || row.expiresAt.getTime() <= Date.now()) return null;
  return row;
}

export async function enqueueCompanionCommand(input: {
  token: string;
  action: string;
  payload?: Record<string, unknown>;
}) {
  const pair = await resolveCompanionToken(input.token);
  if (!pair) return { ok: false as const, error: "Invalid or expired companion token." };

  const action = input.action.trim().toLowerCase();
  if (action !== "research" && action !== "reminder" && action !== "assistant_command") {
    return { ok: false as const, error: "Unknown action. Use research, reminder, or assistant_command." };
  }

  const command = await prisma.mobileCompanionCommand.create({
    data: {
      pairId: pair.id,
      action,
      payload: JSON.stringify(input.payload ?? {}),
      status: "queued",
    },
  });
  await prisma.mobileCompanionPair.update({
    where: { id: pair.id },
    data: { lastCommandAt: new Date() },
  });

  if (action === "assistant_command") {
    const text =
      typeof input.payload?.text === "string" && input.payload.text.trim()
        ? input.payload.text.trim()
        : "";
    if (!text) {
      return { ok: false as const, error: "assistant_command requires payload.text." };
    }
    await prisma.mobileCompanionCommand.update({
      where: { id: command.id },
      data: { status: "queued" },
    });
    return { ok: true as const, commandId: command.id, pairId: pair.id, workspaceId: pair.workspaceId };
  }

  if (action === "research") {
    const agent = await prisma.agent.findFirst({
      where: { workspaceId: pair.workspaceId, status: { not: "archived" } },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    if (agent) {
      const message =
        typeof input.payload?.query === "string" && input.payload.query.trim()
          ? input.payload.query.trim()
          : "Run multi-tab research from mobile companion.";
      try {
        const job = await createJobFromChat({
          workspaceId: pair.workspaceId,
          agentId: agent.id,
          message,
          playbookKey: "multi_tab_research",
        });
        await prisma.mobileCompanionCommand.update({
          where: { id: command.id },
          data: {
            status: "done",
            result: JSON.stringify({ jobId: job.job.id }),
          },
        });
      } catch (error) {
        await prisma.mobileCompanionCommand.update({
          where: { id: command.id },
          data: {
            status: "failed",
            result: JSON.stringify({
              error: error instanceof Error ? error.message : "Could not start research.",
            }),
          },
        });
      }
    }
  }

  return { ok: true as const, commandId: command.id, pairId: pair.id, workspaceId: pair.workspaceId };
}

export async function listPendingCompanionCommands(userId: string) {
  const pairs = await prisma.mobileCompanionPair.findMany({
    where: { userId, status: "active", expiresAt: { gt: new Date() } },
    select: { id: true },
  });
  if (!pairs.length) return [];
  const commands = await prisma.mobileCompanionCommand.findMany({
    where: {
      pairId: { in: pairs.map((p) => p.id) },
      status: "queued",
      action: "reminder",
    },
    orderBy: { createdAt: "asc" },
    take: 20,
  });
  return commands;
}

export async function ackCompanionCommand(commandId: string, userId: string, result: Record<string, unknown>) {
  const command = await prisma.mobileCompanionCommand.findUnique({
    where: { id: commandId },
    include: { pair: { select: { userId: true } } },
  });
  if (!command || command.pair.userId !== userId) return false;
  await prisma.mobileCompanionCommand.update({
    where: { id: commandId },
    data: { status: "done", result: JSON.stringify(result) },
  });
  return true;
}

export async function activeCompanionPair(userId: string) {
  return prisma.mobileCompanionPair.findFirst({
    where: {
      userId,
      status: { in: ["pending", "active"] },
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });
}
