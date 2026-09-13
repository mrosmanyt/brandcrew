import { randomBytes } from "node:crypto";
import type { SessionUser } from "@/lib/auth";
import { ClientError } from "@/lib/http";
import { prisma } from "@/lib/db";
import { llm } from "@/lib/llm";
import {
  HELPDESK_FALLBACK_ACK,
  HELPDESK_JOINED_NOTE,
  HELPDESK_MESSAGE_MAX,
  HELPDESK_PRESENCE_ID,
  clipHelpdeskText,
  founderIsAvailable,
  helpdeskAckForLiveRequest,
  helpdeskAckSystemPrompt,
  helpdeskAckUserPrompt,
  helpdeskPreview,
  isValidHelpdeskEmail,
  nextStatusAfterFounderReply,
  nextStatusAfterUserMessage,
  normalizeHelpdeskPageUrl,
  parseHelpdeskStatus,
  sanitizeHelpdeskAck,
  shouldAutoAckUserMessage,
  type HelpdeskInbox,
  type HelpdeskMessageDTO,
  type HelpdeskStatus,
  type HelpdeskThreadDTO,
  type HelpdeskViewer,
} from "@/lib/helpdesk-pure";

export {
  HELPDESK_FALLBACK_ACK,
  HELPDESK_JOINED_NOTE,
  HELPDESK_LIVE_AVAILABLE_ACK,
  HELPDESK_LIVE_OFFLINE_ACK,
  HELPDESK_MESSAGE_MAX,
  founderIsAvailable,
  helpdeskAckForLiveRequest,
  helpdeskPreview,
  isHelpdeskAdminHiddenPath,
  isValidHelpdeskEmail,
  normalizeHelpdeskPageUrl,
  parseHelpdeskStatus,
  sanitizeHelpdeskAck,
  shouldAutoAckUserMessage,
  type HelpdeskMessageDTO,
  type HelpdeskStatus,
  type HelpdeskThreadDTO,
  type HelpdeskViewer,
} from "@/lib/helpdesk-pure";

type ThreadRow = {
  id: string;
  userId: string | null;
  email: string;
  name: string;
  workspaceId: string | null;
  pageUrl: string;
  preview: string;
  status: string;
  liveRequested: boolean;
  liveActive: boolean;
  guestKey: string;
  createdAt: Date;
  updatedAt: Date;
  lastMessageAt: Date;
  messages?: MessageRow[];
};

type MessageRow = {
  id: string;
  role: string;
  body: string;
  authorEmail: string;
  createdAt: Date;
};

function serializeMessage(row: MessageRow): HelpdeskMessageDTO {
  const role =
    row.role === "founder" || row.role === "ai" || row.role === "user" ? row.role : "user";
  return {
    id: row.id,
    role,
    body: row.body,
    authorEmail: row.authorEmail,
    createdAt: row.createdAt.toISOString(),
  };
}

function serializeThread(row: ThreadRow, opts?: { includeGuestKey?: boolean }): HelpdeskThreadDTO {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    workspaceId: row.workspaceId,
    pageUrl: row.pageUrl,
    preview: row.preview,
    status: parseHelpdeskStatus(row.status),
    liveRequested: row.liveRequested,
    liveActive: row.liveActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    lastMessageAt: row.lastMessageAt.toISOString(),
    ...(opts?.includeGuestKey && row.guestKey ? { guestKey: row.guestKey } : {}),
    ...(row.messages ? { messages: row.messages.map(serializeMessage) } : {}),
  };
}

function newGuestKey() {
  return randomBytes(24).toString("hex");
}

export function viewerFromUser(user: SessionUser | null): HelpdeskViewer {
  return {
    signedIn: Boolean(user),
    email: user?.email ?? "",
    name: user?.name ?? "",
  };
}

export async function getFounderAvailability(now = Date.now()): Promise<{
  available: boolean;
  lastSeenAt: string | null;
}> {
  const row = await prisma.supportStaffPresence.findUnique({
    where: { id: HELPDESK_PRESENCE_ID },
  });
  return {
    available: founderIsAvailable(row?.lastSeenAt ?? null, now),
    lastSeenAt: row?.lastSeenAt?.toISOString() ?? null,
  };
}

export async function touchFounderPresence(actorEmail: string) {
  const now = new Date();
  await prisma.supportStaffPresence.upsert({
    where: { id: HELPDESK_PRESENCE_ID },
    create: { id: HELPDESK_PRESENCE_ID, lastSeenAt: now, actorEmail },
    update: { lastSeenAt: now, actorEmail },
  });
  return { available: true, lastSeenAt: now.toISOString() };
}

async function recordHelpdeskAudit(input: {
  actorEmail: string;
  action: string;
  targetId: string;
  meta?: Record<string, unknown>;
}) {
  await prisma.adminAuditLog.create({
    data: {
      actorEmail: input.actorEmail,
      action: input.action,
      targetId: input.targetId,
      meta: JSON.stringify(input.meta ?? {}),
    },
  });
}

export async function composeHelpdeskAck(input: {
  message: string;
  founderAvailable: boolean;
  liveRequested: boolean;
  pageUrl?: string;
}): Promise<{ text: string; source: "llm" | "template" }> {
  const template = input.liveRequested
    ? helpdeskAckForLiveRequest(input.founderAvailable)
    : HELPDESK_FALLBACK_ACK;
  if (!llm.isLiveFor("classify")) {
    return { text: template, source: "template" };
  }
  try {
    const result = await llm.complete({
      mode: "draft",
      kind: "classify",
      messages: [
        { role: "system", content: helpdeskAckSystemPrompt() },
        {
          role: "user",
          content: helpdeskAckUserPrompt(input.message, {
            founderAvailable: input.founderAvailable,
            liveRequested: input.liveRequested,
            pageUrl: input.pageUrl,
          }),
        },
      ],
    });
    const text = sanitizeHelpdeskAck(result.text);
    return { text, source: "llm" };
  } catch {
    return { text: template, source: "template" };
  }
}

function assertMessageBody(raw: string): string {
  const body = clipHelpdeskText(raw, HELPDESK_MESSAGE_MAX);
  if (!body) throw new ClientError("Write a short message so we can help.");
  return body;
}

async function addMessage(input: {
  threadId: string;
  role: "user" | "ai" | "founder";
  body: string;
  authorEmail?: string;
}) {
  return prisma.supportMessage.create({
    data: {
      threadId: input.threadId,
      role: input.role,
      body: input.body,
      authorEmail: input.authorEmail ?? "",
    },
  });
}

export async function listViewerThreads(input: {
  user: SessionUser | null;
  guestKey?: string | null;
}): Promise<HelpdeskThreadDTO[]> {
  const or: Array<{ userId?: string; guestKey?: string }> = [];
  if (input.user) or.push({ userId: input.user.id });
  const guestKey = input.guestKey?.trim() || "";
  if (guestKey) or.push({ guestKey });
  if (!or.length) return [];
  const rows = await prisma.supportThread.findMany({
    where: { OR: or },
    orderBy: { lastMessageAt: "desc" },
    take: 20,
  });
  return rows.map((row) => serializeThread(row));
}

export async function getViewerThread(input: {
  threadId: string;
  user: SessionUser | null;
  guestKey?: string | null;
}): Promise<HelpdeskThreadDTO> {
  const row = await prisma.supportThread.findUnique({
    where: { id: input.threadId },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!row) throw new ClientError("Help thread not found.", 404, "not_found");
  const guestKey = input.guestKey?.trim() || "";
  const owns =
    (input.user && row.userId === input.user.id) ||
    (guestKey && row.guestKey && row.guestKey === guestKey);
  if (!owns) throw new ClientError("Help thread not found.", 404, "not_found");
  return serializeThread(row);
}

export async function createHelpdeskThread(input: {
  user: SessionUser | null;
  email?: string | null;
  name?: string | null;
  message: string;
  pageUrl?: string | null;
  workspaceId?: string | null;
  liveRequested?: boolean;
}): Promise<HelpdeskThreadDTO> {
  const body = assertMessageBody(input.message);
  const email = (input.user?.email || input.email || "").trim().toLowerCase();
  const name = (input.user?.name || input.name || "").trim().slice(0, 80);
  if (!input.user && !isValidHelpdeskEmail(email)) {
    throw new ClientError("Enter a valid email so the team can follow up.");
  }
  const pageUrl = normalizeHelpdeskPageUrl(input.pageUrl);
  let workspaceId = input.workspaceId?.trim() || null;
  if (workspaceId) {
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true },
    });
    if (!workspace) workspaceId = null;
  }
  const liveRequested = Boolean(input.liveRequested);
  const { available } = await getFounderAvailability();
  const guestKey = input.user ? "" : newGuestKey();
  const status = nextStatusAfterUserMessage({
    liveActive: false,
    liveRequested,
    founderAvailable: available,
    current: "open",
  });

  const thread = await prisma.supportThread.create({
    data: {
      userId: input.user?.id ?? null,
      email: email || input.user?.email || "",
      name,
      workspaceId,
      pageUrl,
      preview: helpdeskPreview(body),
      status,
      liveRequested,
      liveActive: false,
      guestKey,
      lastMessageAt: new Date(),
    },
  });
  await addMessage({
    threadId: thread.id,
    role: "user",
    body,
    authorEmail: email,
  });
  const ack = await composeHelpdeskAck({
    message: body,
    founderAvailable: available,
    liveRequested,
    pageUrl,
  });
  await addMessage({
    threadId: thread.id,
    role: "ai",
    body: ack.text,
  });

  const full = await prisma.supportThread.findUniqueOrThrow({
    where: { id: thread.id },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  return serializeThread(full, { includeGuestKey: Boolean(guestKey) });
}

export async function appendViewerMessage(input: {
  threadId: string;
  user: SessionUser | null;
  guestKey?: string | null;
  message?: string | null;
  liveRequested?: boolean;
  pageUrl?: string | null;
}): Promise<HelpdeskThreadDTO> {
  const existing = await prisma.supportThread.findUnique({
    where: { id: input.threadId },
  });
  if (!existing) throw new ClientError("Help thread not found.", 404, "not_found");
  const guestKey = input.guestKey?.trim() || "";
  const owns =
    (input.user && existing.userId === input.user.id) ||
    (guestKey && existing.guestKey && existing.guestKey === guestKey);
  if (!owns) throw new ClientError("Help thread not found.", 404, "not_found");

  const body = input.message != null ? assertMessageBody(input.message) : "";
  const liveRequested = existing.liveRequested || Boolean(input.liveRequested);
  const { available } = await getFounderAvailability();
  const pageUrl = normalizeHelpdeskPageUrl(input.pageUrl) || existing.pageUrl;
  const now = new Date();
  const status = nextStatusAfterUserMessage({
    liveActive: existing.liveActive,
    liveRequested,
    founderAvailable: available,
    current: existing.status,
  });

  if (body) {
    await addMessage({
      threadId: existing.id,
      role: "user",
      body,
      authorEmail: input.user?.email || existing.email,
    });
  }

  const shouldAck =
    Boolean(body) &&
    shouldAutoAckUserMessage({
      liveActive: existing.liveActive,
      status: existing.status,
    });
  if (shouldAck) {
    const ack = await composeHelpdeskAck({
      message: body || "Live chat requested.",
      founderAvailable: available,
      liveRequested,
      pageUrl,
    });
    await addMessage({
      threadId: existing.id,
      role: "ai",
      body: ack.text,
    });
  } else if (!body && liveRequested && !existing.liveRequested) {
    const ack = await composeHelpdeskAck({
      message: "I'd like to talk with the team live.",
      founderAvailable: available,
      liveRequested: true,
      pageUrl,
    });
    await addMessage({
      threadId: existing.id,
      role: "ai",
      body: ack.text,
    });
  }

  const updated = await prisma.supportThread.update({
    where: { id: existing.id },
    data: {
      status,
      liveRequested,
      pageUrl,
      preview: body ? helpdeskPreview(body) : existing.preview,
      lastMessageAt: now,
      ...(input.user && !existing.userId
        ? { userId: input.user.id, email: input.user.email, name: input.user.name, guestKey: "" }
        : {}),
    },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  return serializeThread(updated);
}

export async function getHelpdeskInbox(input?: {
  status?: string | null;
  q?: string | null;
}): Promise<HelpdeskInbox> {
  const status = input?.status?.trim().toLowerCase() || "";
  const q = input?.q?.trim() || "";
  const [presence, open, live, threads] = await Promise.all([
    getFounderAvailability(),
    prisma.supportThread.count({ where: { status: { in: ["open", "live"] } } }),
    prisma.supportThread.count({ where: { status: "live" } }),
    prisma.supportThread.findMany({
      where: {
        ...(status && status !== "all" ? { status } : {}),
        ...(q
          ? {
              OR: [
                { email: { contains: q, mode: "insensitive" } },
                { name: { contains: q, mode: "insensitive" } },
                { preview: { contains: q, mode: "insensitive" } },
                { pageUrl: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { lastMessageAt: "desc" },
      take: 80,
    }),
  ]);
  return {
    section: "support",
    founderAvailable: presence.available,
    lastSeenAt: presence.lastSeenAt,
    open,
    live,
    threads: threads.map((row) => serializeThread(row)),
  };
}

export async function getAdminHelpdeskThread(threadId: string): Promise<HelpdeskThreadDTO> {
  const row = await prisma.supportThread.findUnique({
    where: { id: threadId },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!row) throw new ClientError("Help thread not found.", 404, "not_found");
  return serializeThread(row);
}

export async function founderReplyToThread(input: {
  threadId: string;
  actorEmail: string;
  body: string;
}): Promise<HelpdeskThreadDTO> {
  const existing = await prisma.supportThread.findUnique({ where: { id: input.threadId } });
  if (!existing) throw new ClientError("Help thread not found.", 404, "not_found");
  const body = assertMessageBody(input.body);
  const status = nextStatusAfterFounderReply(existing.liveActive);
  await addMessage({
    threadId: existing.id,
    role: "founder",
    body,
    authorEmail: input.actorEmail,
  });
  const updated = await prisma.supportThread.update({
    where: { id: existing.id },
    data: {
      status,
      preview: helpdeskPreview(body),
      lastMessageAt: new Date(),
    },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  await recordHelpdeskAudit({
    actorEmail: input.actorEmail,
    action: "helpdesk_reply",
    targetId: existing.id,
    meta: { status },
  });
  return serializeThread(updated);
}

export async function founderJoinLive(input: {
  threadId: string;
  actorEmail: string;
}): Promise<HelpdeskThreadDTO> {
  const existing = await prisma.supportThread.findUnique({ where: { id: input.threadId } });
  if (!existing) throw new ClientError("Help thread not found.", 404, "not_found");
  if (!existing.liveActive) {
    await addMessage({
      threadId: existing.id,
      role: "ai",
      body: HELPDESK_JOINED_NOTE,
    });
  }
  const updated = await prisma.supportThread.update({
    where: { id: existing.id },
    data: {
      status: "live",
      liveRequested: true,
      liveActive: true,
      lastMessageAt: new Date(),
    },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  await recordHelpdeskAudit({
    actorEmail: input.actorEmail,
    action: "helpdesk_join_live",
    targetId: existing.id,
  });
  return serializeThread(updated);
}

export async function founderLeaveLive(input: {
  threadId: string;
  actorEmail: string;
}): Promise<HelpdeskThreadDTO> {
  const existing = await prisma.supportThread.findUnique({ where: { id: input.threadId } });
  if (!existing) throw new ClientError("Help thread not found.", 404, "not_found");
  const updated = await prisma.supportThread.update({
    where: { id: existing.id },
    data: {
      liveActive: false,
      status: existing.status === "closed" ? "closed" : "replied",
    },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  await recordHelpdeskAudit({
    actorEmail: input.actorEmail,
    action: "helpdesk_leave_live",
    targetId: existing.id,
  });
  return serializeThread(updated);
}

export async function founderSetThreadStatus(input: {
  threadId: string;
  actorEmail: string;
  status: HelpdeskStatus;
}): Promise<HelpdeskThreadDTO> {
  const existing = await prisma.supportThread.findUnique({ where: { id: input.threadId } });
  if (!existing) throw new ClientError("Help thread not found.", 404, "not_found");
  const updated = await prisma.supportThread.update({
    where: { id: input.threadId },
    data: {
      status: input.status,
      liveActive: input.status === "live" ? true : false,
    },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  await recordHelpdeskAudit({
    actorEmail: input.actorEmail,
    action: input.status === "closed" ? "helpdesk_close" : "helpdesk_status",
    targetId: existing.id,
    meta: { status: input.status },
  });
  return serializeThread(updated);
}

export async function getHelpdeskOverviewCounts(): Promise<{ open: number; live: number }> {
  const [open, live] = await Promise.all([
    prisma.supportThread.count({ where: { status: { in: ["open", "live"] } } }),
    prisma.supportThread.count({ where: { status: "live" } }),
  ]);
  return { open, live };
}
