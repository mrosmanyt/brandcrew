/**
 * Streaming chat product service (ChatGPT-style surface).
 *
 * Owns: per-user conversations (ChatConversation/ChatMessage), reconciliation
 * of client-sent history with stored rows, route resolution through the
 * existing model catalog + llm routing, and reply persistence + usage
 * metering. Conversations are metered against the user's primary workspace
 * so plan limits (plan id `demo` = Free, credits wrap token budgets) apply
 * exactly as they do for desk chat.
 */
import { Prisma } from "@prisma/client";
import type { ComposerAttachment } from "@/lib/composer";
import {
  normalizeComposerAttachments,
  toWireAttachments,
} from "@/lib/composer-media";
import { prisma } from "@/lib/db";
import { ClientError } from "@/lib/http";
import {
  completeRouteCandidates,
  hasAnthropic,
  hasGemini,
  hasOpenAI,
  hasXai,
  routeForCatalogModel,
  type LlmRoute,
} from "@/lib/llm";
import { normalizeModelRouting } from "@/lib/llm-routing";
import { displayModelById } from "@/lib/model-catalog";
import {
  generateConversationTitle,
  reconcileChatMessages,
  type ChatMessageLike,
} from "@/lib/chat-stream-pure";
import { isExpertId } from "@/lib/experts";
import { recordUsage } from "@/lib/usage";
import { createDemoWorkspace, listUserWorkspaces } from "@/lib/workspace";

export const CHAT_SYSTEM_PROMPT =
  "You are the CINEM Pro chat assistant. Answer directly and well, in the user's language. Use markdown when it helps: short paragraphs, lists, and fenced code blocks with a language tag for code.";

export type ChatConversationDTO = {
  id: string;
  title: string;
  modelId: string | null;
  /** Curated expert id (Package 5) active on this conversation, or null. */
  expertId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ChatMessageDTO = {
  id: string;
  role: string;
  content: string;
  model: string | null;
  provider: string | null;
  tokens: number;
  createdAt: string;
  /** Wire attachments on a user message; [] when the message has none. */
  attachments: ComposerAttachment[];
  /** Web-search sources an assistant reply was grounded on; [] when none. */
  sources: { title: string; url: string }[];
};

type ConversationRow = {
  id: string;
  title: string;
  modelId: string | null;
  expertId?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type MessageRow = {
  id: string;
  role: string;
  content: string;
  model: string | null;
  provider: string | null;
  tokens: number;
  createdAt: Date;
  attachments?: unknown;
  sources?: unknown;
};

/** Stored JSON → search sources. Anything unexpected reads as "none". */
export function parseStoredSources(
  value: unknown,
): { title: string; url: string }[] {
  if (!Array.isArray(value)) return [];
  const out: { title: string; url: string }[] = [];
  for (const row of value) {
    if (!row || typeof row !== "object") continue;
    const title = (row as { title?: unknown }).title;
    const url = (row as { url?: unknown }).url;
    if (typeof url === "string" && url.trim()) {
      out.push({
        title: typeof title === "string" && title.trim() ? title : url,
        url,
      });
    }
  }
  // Deep-research reports legitimately carry more sources than a single
  // web search (max 5); the cap stays bounded either way.
  return out.slice(0, 40);
}

/** Stored JSON → wire attachments. Anything unexpected reads as "none". */
export function parseStoredAttachments(value: unknown): ComposerAttachment[] {
  if (!Array.isArray(value)) return [];
  return toWireAttachments(normalizeComposerAttachments(value as ComposerAttachment[]));
}

/** Client-sent attachments → the normalized wire shape we persist. */
export function prepareAttachmentsForStorage(
  files: ComposerAttachment[] | undefined,
): ComposerAttachment[] {
  if (!files?.length) return [];
  return toWireAttachments(normalizeComposerAttachments(files));
}

export function serializeChatConversation(row: ConversationRow): ChatConversationDTO {
  return {
    id: row.id,
    title: row.title,
    modelId: row.modelId,
    expertId: row.expertId ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function serializeChatMessage(row: MessageRow): ChatMessageDTO {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    model: row.model,
    provider: row.provider,
    tokens: row.tokens,
    createdAt: row.createdAt.toISOString(),
    attachments: parseStoredAttachments(row.attachments),
    sources: parseStoredSources(row.sources),
  };
}

/** Primary workspace for chat metering; auto-created like the desk does. */
export async function resolveChatWorkspace(userId: string, userName: string) {
  const workspaces = await listUserWorkspaces(userId);
  if (workspaces.length) return workspaces[0];
  return createDemoWorkspace(userId, `${userName}'s desk`);
}

export async function listChatConversations(userId: string) {
  const rows = await prisma.chatConversation.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });
  return rows.map(serializeChatConversation);
}

export async function createChatConversation(input: {
  userId: string;
  userName: string;
  title?: string;
  modelId?: string | null;
  expertId?: string | null;
}) {
  const workspace = await resolveChatWorkspace(input.userId, input.userName);
  const row = await prisma.chatConversation.create({
    data: {
      userId: input.userId,
      workspaceId: workspace.id,
      title: input.title?.trim() || "New chat",
      modelId: input.modelId ? normalizeModelRouting(input.modelId) : null,
      // Only curated expert ids persist; anything else reads as no expert.
      expertId: isExpertId(input.expertId) ? input.expertId : null,
    },
  });
  return serializeChatConversation(row);
}

export async function getChatConversation(userId: string, conversationId: string) {
  const row = await prisma.chatConversation.findFirst({
    where: { id: conversationId, userId },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!row) throw new ClientError("Conversation not found.", 404, "not_found");
  return {
    conversation: serializeChatConversation(row),
    messages: row.messages.map(serializeChatMessage),
  };
}

export async function renameChatConversation(
  userId: string,
  conversationId: string,
  patch: { title?: string; modelId?: string | null; expertId?: string | null },
) {
  const existing = await prisma.chatConversation.findFirst({
    where: { id: conversationId, userId },
    select: { id: true },
  });
  if (!existing) throw new ClientError("Conversation not found.", 404, "not_found");
  const row = await prisma.chatConversation.update({
    where: { id: conversationId },
    data: {
      ...(patch.title !== undefined ? { title: patch.title.trim() || "New chat" } : {}),
      ...(patch.modelId !== undefined
        ? { modelId: patch.modelId ? normalizeModelRouting(patch.modelId) : null }
        : {}),
      ...(patch.expertId !== undefined
        ? { expertId: isExpertId(patch.expertId) ? patch.expertId : null }
        : {}),
    },
  });
  return serializeChatConversation(row);
}

export async function deleteChatConversation(userId: string, conversationId: string) {
  const existing = await prisma.chatConversation.findFirst({
    where: { id: conversationId, userId },
    select: { id: true },
  });
  if (!existing) throw new ClientError("Conversation not found.", 404, "not_found");
  await prisma.chatConversation.delete({ where: { id: conversationId } });
}

export function providerConfigured(
  provider: "anthropic" | "openai" | "gemini" | "xai",
): boolean {
  if (provider === "anthropic") return hasAnthropic();
  if (provider === "openai") return hasOpenAI();
  if (provider === "xai") return hasXai();
  return hasGemini();
}

export function chatProviderLabel(provider: string | null): string {
  if (provider === "anthropic") return "Anthropic (Claude)";
  if (provider === "openai") return "OpenAI (ChatGPT)";
  if (provider === "gemini") return "Google (Gemini)";
  if (provider === "xai") return "xAI (Grok)";
  return "AI provider";
}

export type ChatRouteResolution =
  | { ok: true; routes: LlmRoute[] }
  | { ok: false; provider: string | null; displayName: string | null };

/**
 * Resolve the picker selection to concrete provider route(s) through the
 * existing catalog + routing. A specifically picked model NEVER silently
 * falls back to another provider: if its provider has no key configured the
 * caller gets an honest "model not configured" resolution. "auto" keeps the
 * existing candidate-chain behavior (cheapest live backend first).
 */
export function resolveChatRoutes(modelId: string, plan: string): ChatRouteResolution {
  const pref = normalizeModelRouting(modelId);
  if (pref === "auto") {
    const routes = completeRouteCandidates("final", "general", "auto", { plan });
    if (!routes.length) return { ok: false, provider: null, displayName: null };
    return { ok: true, routes };
  }
  const row = displayModelById(pref);
  if (!row) return { ok: false, provider: null, displayName: null };
  if (!providerConfigured(row.provider)) {
    return { ok: false, provider: row.provider, displayName: row.displayName };
  }
  // Strict resolution: the picked model's own provider route, exactly the
  // model the picker named — no plan-based downgrade, no cross-provider
  // swap. Plan budgets still apply downstream via assertLlmCallBudget.
  const route = routeForCatalogModel(pref);
  if (!route) return { ok: false, provider: row.provider, displayName: row.displayName };
  return { ok: true, routes: [route] };
}

export type PreparedChatTurn = {
  workspaceId: string;
  plan: string;
  conversation: ChatConversationDTO;
  /** Id of the stored user message this turn answers (null on regenerate of an empty tail). */
  userMessageId: string | null;
};

/**
 * Load-or-create the conversation and persist the client-sent history delta
 * (see reconcileChatMessages): new user messages are appended, edited or
 * regenerated tails are replaced — never duplicated.
 */
export async function prepareChatTurn(input: {
  userId: string;
  userName: string;
  conversationId?: string | null;
  modelId: string;
  /** Expert for a conversation created by this turn; an existing
   * conversation always keeps the expert already persisted on it. */
  expertId?: string | null;
  messages: ChatMessageLike[];
}): Promise<PreparedChatTurn> {
  const workspace = await resolveChatWorkspace(input.userId, input.userName);
  const modelPref = normalizeModelRouting(input.modelId);

  let conversationId = input.conversationId || null;
  let stored: Array<MessageRow> = [];
  if (conversationId) {
    const row = await prisma.chatConversation.findFirst({
      where: { id: conversationId, userId: input.userId },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
    if (!row) throw new ClientError("Conversation not found.", 404, "not_found");
    stored = row.messages;
  } else {
    const firstUser = input.messages.find((message) => message.role === "user");
    const titleSeed =
      firstUser?.content.trim() ||
      firstUser?.attachments?.find((file) => !file.error)?.name ||
      "";
    const created = await prisma.chatConversation.create({
      data: {
        userId: input.userId,
        workspaceId: workspace.id,
        title: generateConversationTitle(titleSeed),
        modelId: modelPref,
        expertId: isExpertId(input.expertId) ? input.expertId : null,
      },
    });
    conversationId = created.id;
  }

  const plan = reconcileChatMessages(
    stored.map((row) => ({ role: row.role, content: row.content })),
    input.messages,
  );

  const deleteIds = stored.slice(plan.keepCount).map((row) => row.id);
  let userMessageId: string | null =
    plan.keepCount > 0 ? stored[plan.keepCount - 1]?.id ?? null : null;

  // Sequential writes (single-owner conversation; the reconcile plan above
  // is computed from a fresh read, so no cross-user race is possible).
  if (deleteIds.length) {
    await prisma.chatMessage.deleteMany({ where: { id: { in: deleteIds } } });
  }
  for (const message of plan.append) {
    const attachments =
      message.role === "user"
        ? prepareAttachmentsForStorage(message.attachments)
        : [];
    const created = await prisma.chatMessage.create({
      data: {
        conversationId: conversationId as string,
        role: message.role,
        content: message.content,
        ...(attachments.length
          ? { attachments: attachments as unknown as Prisma.InputJsonValue }
          : {}),
      },
    });
    if (message.role === "user") userMessageId = created.id;
  }
  await prisma.chatConversation.update({
    where: { id: conversationId as string },
    data: { modelId: modelPref },
  });

  const fresh = await prisma.chatConversation.findUnique({
    where: { id: conversationId },
  });
  if (!fresh) throw new ClientError("Conversation not found.", 404, "not_found");
  return {
    workspaceId: workspace.id,
    plan: workspace.plan,
    conversation: serializeChatConversation(fresh),
    userMessageId,
  };
}

/** Persist the assistant reply and meter it against the workspace. */
export async function persistChatReply(input: {
  conversationId: string;
  workspaceId: string;
  content: string;
  model: string;
  provider: string;
  tokens: number;
  sources?: { title: string; url: string }[];
}): Promise<ChatMessageDTO> {
  const row = await prisma.chatMessage.create({
    data: {
      conversationId: input.conversationId,
      role: "assistant",
      content: input.content,
      model: input.model,
      provider: input.provider,
      tokens: input.tokens,
      ...(input.sources?.length
        ? { sources: input.sources as unknown as Prisma.InputJsonValue }
        : {}),
    },
  });
  await prisma.chatConversation.update({
    where: { id: input.conversationId },
    data: { updatedAt: new Date() },
  });
  await recordUsage({
    workspaceId: input.workspaceId,
    tokens: input.tokens,
    model: input.model,
    agentRole: "chat",
    bucket: "chat",
  });
  return serializeChatMessage(row);
}
