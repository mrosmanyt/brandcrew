/**
 * Server-side queue: phone/webhook → signed-in user's desktop Assistant poller.
 */
import { prisma } from "@/lib/db";

export async function enqueueAssistantRemoteCommand(input: {
  userId: string;
  channel: string;
  sourceId?: string;
  text: string;
}) {
  const text = input.text.trim();
  if (!text) throw new Error("Empty command.");
  return prisma.assistantRemoteCommand.create({
    data: {
      userId: input.userId,
      channel: input.channel,
      sourceId: input.sourceId ?? "",
      text,
      status: "queued",
    },
  });
}

export async function listQueuedRemoteCommands(userId: string, limit = 20) {
  return prisma.assistantRemoteCommand.findMany({
    where: { userId, status: "queued" },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
}

export async function markRemoteCommandRunning(id: string, userId: string) {
  const row = await prisma.assistantRemoteCommand.findUnique({ where: { id } });
  if (!row || row.userId !== userId) return false;
  await prisma.assistantRemoteCommand.update({
    where: { id },
    data: { status: "running" },
  });
  return true;
}

export async function completeRemoteCommand(
  id: string,
  userId: string,
  replyText: string,
  ok = true,
) {
  const row = await prisma.assistantRemoteCommand.findUnique({ where: { id } });
  if (!row || row.userId !== userId) return false;
  await prisma.assistantRemoteCommand.update({
    where: { id },
    data: {
      status: ok ? "done" : "failed",
      replyText: replyText.slice(0, 8000),
    },
  });
  return true;
}

/** Bridge cloud queue into companion poll shape for the desktop Assistant. */
export async function companionPollCommands(userId: string) {
  const remote = await listQueuedRemoteCommands(userId);
  if (remote.length) {
    await prisma.assistantRemoteCommand.updateMany({
      where: { id: { in: remote.map((r) => r.id) } },
      data: { status: "running" },
    });
  }
  const companion = await prisma.mobileCompanionCommand.findMany({
    where: {
      status: "queued",
      pair: { userId, status: "active", expiresAt: { gt: new Date() } },
      action: { in: ["reminder", "assistant_command"] },
    },
    orderBy: { createdAt: "asc" },
    take: 20,
    include: { pair: { select: { userId: true } } },
  });

  const fromRemote = remote.map((row) => ({
    id: row.id,
    action: "assistant_command" as const,
    payload: {
      text: row.text,
      channel: row.channel,
      sourceId: row.sourceId,
    },
    createdAt: row.createdAt.toISOString(),
  }));

  const fromCompanion = companion.map((row) => ({
    id: row.id,
    action: row.action,
    payload: JSON.parse(row.payload || "{}") as Record<string, unknown>,
    createdAt: row.createdAt.toISOString(),
  }));

  return [...fromCompanion, ...fromRemote];
}

export async function ackCompanionOrRemoteCommand(
  commandId: string,
  userId: string,
  result: Record<string, unknown>,
) {
  const remote = await prisma.assistantRemoteCommand.findUnique({ where: { id: commandId } });
  if (remote && remote.userId === userId) {
    await prisma.assistantRemoteCommand.update({
      where: { id: commandId },
      data: {
        status: result.ok === false ? "failed" : "done",
        replyText: JSON.stringify(result).slice(0, 8000),
      },
    });
    return true;
  }

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
