import { randomBytes } from "node:crypto";
import type { SessionUser } from "@/lib/auth";
import { ClientError } from "@/lib/http";
import { prisma } from "@/lib/db";
import { llm } from "@/lib/llm";
import {
  HELPDESK_ACK_BUDGET_MS,
  HELPDESK_CHAT_FALLBACK,
  HELPDESK_ESCALATE_ACK,
  HELPDESK_JOINED_NOTE,
  HELPDESK_MESSAGE_MAX,
  HELPDESK_PRESENCE_ID,
  classifyHelpdeskMessage,
  clipHelpdeskText,
  founderIsAvailable,
  helpdeskAckForLiveRequest,
  helpdeskAckSystemPrompt,
  helpdeskAckUserPrompt,
  helpdeskCannedReply,
  helpdeskPreview,
  isValidHelpdeskEmail,
  nextStatusAfterFounderReply,
  nextStatusAfterHelpReply,
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
  HELPDESK_ACK_BUDGET_MS,
  HELPDESK_CHAT_FALLBACK,
  HELPDESK_ESCALATE_ACK,
  HELPDESK_FALLBACK_ACK,
  HELPDESK_JOINED_NOTE,
  HELPDESK_LIVE_AVAILABLE_ACK,
  HELPDESK_LIVE_OFFLINE_ACK,
  HELPDESK_MESSAGE_MAX,
  HELPDESK_ONLINE_STATUS,
  classifyHelpdeskMessage,
  founderIsAvailable,
  helpdeskAckForLiveRequest,
  helpdeskCannedReply,
  helpdeskNetworkErrorMessage,
  helpdeskPresenceLabel,
  helpdeskPreview,
  isHelpdeskAdminHiddenPath,
  isHelpdeskRetryableNetworkError,
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
}): Promise<{ text: string; source: "llm" | "template"; route: "answer" | "escalate" }> {
  const classified = classifyHelpdeskMessage(input.message, {
    liveRequested: input.liveRequested,
  });
  if (classified.route === "answer" && classified.topic) {
    return {
      text: helpdeskCannedReply(classified.topic),
      source: "template",
      route: "answer",
    };
  }
  const template = input.liveRequested
    ? helpdeskAckForLiveRequest(input.founderAvailable)
    : classified.route === "escalate" || classified.looksLikeIssue
      ? HELPDESK_ESCALATE_ACK
      : HELPDESK_CHAT_FALLBACK;
  const route = input.liveRequested || classified.route === "escalate" ? "escalate" : "answer";
  if (!llm.isLiveFor("classify")) {
    return { text: template, source: "template", route };
  }
  try {
    const result = await withAckBudget(
      llm.complete({
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
              route,
            }),
          },
        ],
      }),
    );
    return { text: sanitizeHelpdeskAck(result.text), source: "llm", route };
  } catch {
    return { text: template, source: "template", route };
  }
}

function withAckBudget<T>(promise: Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("HELPDESK_ACK_TIMEOUT")), HELPDESK_ACK_BUDGET_MS);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
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
  return rows.map((row) => serializeThread(row, { includeGuestKey: Boolean(guestKey) }));
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
  return serializeThread(row, { includeGuestKey: Boolean(guestKey) });
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
  const ack = await composeHelpdeskAck({
    message: body,
    founderAvailable: available,
    liveRequested,
    pageUrl,
  });
  const status = nextStatusAfterHelpReply({
    liveActive: false,
    liveRequested,
    route: ack.route,
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

  if (body) {
    await addMessage({
      threadId: existing.id,
      role: "user",
      body,
      authorEmail: input.user?.email || existing.email,
    });
  }

  let route: "answer" | "escalate" = liveRequested ? "escalate" : "answer";
  const shouldAck =
    (Boolean(body) &&
      shouldAutoAckUserMessage({
        liveActive: existing.liveActive,
        status: existing.status,
      })) ||
    (!body && liveRequested && !existing.liveRequested);
  if (shouldAck) {
    const ack = await composeHelpdeskAck({
      message: body || "I'd like to talk with the CINEM team live.",
      founderAvailable: available,
      liveRequested,
      pageUrl,
    });
    route = ack.route;
    await addMessage({
      threadId: existing.id,
      role: "ai",
      body: ack.text,
    });
  }
  const status = nextStatusAfterHelpReply({
    liveActive: existing.liveActive,
    liveRequested,
    route,
  });

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
  return serializeThread(updated, {
    includeGuestKey: Boolean(existing.guestKey) && !input.user,
  });
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
