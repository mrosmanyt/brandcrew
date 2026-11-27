/**
 * Canvas workspace service (ChatGPT Canvas-style surface beside chat).
 *
 * Owns: per-conversation canvases (ChatCanvas) and their restorable
 * versions (ChatCanvasVersion), user saves, restores, and the AI edit
 * turn. The AI edit is the cost-sensitive part: the model sees the
 * document as numbered blocks and returns ONLY targeted edit operations
 * (src/lib/chat-canvas-pure.ts) — never a full rewrite. An edit that
 * cannot be parsed or applied cleanly fails honestly and leaves the
 * canvas untouched; there is no silent full-document fallback.
 *
 * Metering follows chat: the conversation's workspace plan budget via
 * assertLlmCallBudget + recordUsage (bucket "chat", role "chat-canvas").
 */
import { prisma } from "@/lib/db";
import { ClientError } from "@/lib/http";
import { llm, runWithLlmRouting } from "@/lib/llm";
import { chatProviderLabel, resolveChatRoutes } from "@/lib/chat";
import { assertLlmCallBudget, recordUsage } from "@/lib/usage";
import { classifySafety, safetyRefusal } from "@/lib/safety-moderation";
import { recordSafetyAlert } from "@/lib/safety-alerts";
import {
  applyCanvasEditOps,
  buildCanvasEditUserPrompt,
  CANVAS_AI_EDIT_MAX_CHARS,
  CANVAS_CONTENT_MAX_CHARS,
  CANVAS_EDIT_SYSTEM_PROMPT,
  CANVAS_TITLE_MAX,
  parseCanvasEditResponse,
  splitCanvasBlocks,
} from "@/lib/chat-canvas-pure";

export type ChatCanvasDTO = {
  id: string;
  conversationId: string;
  title: string;
  kind: string;
  language: string;
  content: string;
  currentVersion: number;
  createdAt: string;
  updatedAt: string;
};

export type ChatCanvasVersionDTO = {
  id: string;
  version: number;
  kind: string;
  instruction: string;
  model: string;
  provider: string;
  tokens: number;
  createdAt: string;
};

type CanvasRow = {
  id: string;
  conversationId: string;
  workspaceId: string;
  title: string;
  kind: string;
  language: string;
  content: string;
  currentVersion: number;
  createdAt: Date;
  updatedAt: Date;
};

type CanvasVersionRow = {
  id: string;
  version: number;
  kind: string;
  instruction: string;
  model: string;
  provider: string;
  tokens: number;
  createdAt: Date;
};

export function serializeChatCanvas(row: CanvasRow): ChatCanvasDTO {
  return {
    id: row.id,
    conversationId: row.conversationId,
    title: row.title,
    kind: row.kind,
    language: row.language,
    content: row.content,
    currentVersion: row.currentVersion,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function serializeChatCanvasVersion(
  row: CanvasVersionRow,
): ChatCanvasVersionDTO {
  return {
    id: row.id,
    version: row.version,
    kind: row.kind,
    instruction: row.instruction,
    model: row.model,
    provider: row.provider,
    tokens: row.tokens,
    createdAt: row.createdAt.toISOString(),
  };
}

async function requireOwnedConversation(userId: string, conversationId: string) {
  const row = await prisma.chatConversation.findFirst({
    where: { id: conversationId, userId },
    select: { id: true, workspaceId: true },
  });
  if (!row) throw new ClientError("Conversation not found.", 404, "not_found");
  return row as { id: string; workspaceId: string };
}

async function loadOwnedCanvas(
  userId: string,
  canvasId: string,
): Promise<CanvasRow> {
  const row = await prisma.chatCanvas.findFirst({
    where: { id: canvasId, userId },
  });
  if (!row) throw new ClientError("Canvas not found.", 404, "not_found");
  return row as CanvasRow;
}

export async function listChatCanvases(userId: string, conversationId: string) {
  await requireOwnedConversation(userId, conversationId);
  const rows = (await prisma.chatCanvas.findMany({
    where: { conversationId, userId },
    orderBy: { updatedAt: "desc" },
    take: 50,
  })) as CanvasRow[];
  return rows.map(serializeChatCanvas);
}

export async function createChatCanvas(input: {
  userId: string;
  conversationId: string;
  title?: string;
  kind?: string;
  language?: string;
  content?: string;
}) {
  const conversation = await requireOwnedConversation(
    input.userId,
    input.conversationId,
  );
  const content = input.content ?? "";
  if (content.length > CANVAS_CONTENT_MAX_CHARS) {
    throw new ClientError(
      "That canvas is larger than the canvas size limit.",
      400,
      "canvas_too_large",
    );
  }
  const kind = input.kind === "code" ? "code" : "document";
  const row = (await prisma.chatCanvas.create({
    data: {
      userId: input.userId,
      workspaceId: conversation.workspaceId,
      conversationId: input.conversationId,
      title: (input.title?.trim() || "Untitled canvas").slice(0, CANVAS_TITLE_MAX),
      kind,
      language: kind === "code" ? (input.language?.trim() ?? "").slice(0, 40) : "",
      content,
      currentVersion: 1,
    },
  })) as CanvasRow;
  await prisma.chatCanvasVersion.create({
    data: {
      canvasId: row.id,
      version: 1,
      kind: "create",
      content,
    },
  });
  return serializeChatCanvas(row);
}

export async function getChatCanvas(userId: string, canvasId: string) {
  const row = await loadOwnedCanvas(userId, canvasId);
  const versions = (await prisma.chatCanvasVersion.findMany({
    where: { canvasId },
    orderBy: { version: "desc" },
    take: 100,
  })) as CanvasVersionRow[];
  return {
    canvas: serializeChatCanvas(row),
    versions: versions.map(serializeChatCanvasVersion),
  };
}

export async function saveChatCanvas(input: {
  userId: string;
  canvasId: string;
  title?: string;
  content?: string;
}) {
  const existing = await loadOwnedCanvas(input.userId, input.canvasId);
  const title =
    input.title !== undefined
      ? (input.title.trim() || existing.title).slice(0, CANVAS_TITLE_MAX)
      : existing.title;
  if (input.content === undefined || input.content === existing.content) {
    if (title !== existing.title) {
      const row = (await prisma.chatCanvas.update({
        where: { id: input.canvasId },
        data: { title },
      })) as CanvasRow;
      return serializeChatCanvas(row);
    }
    return serializeChatCanvas(existing);
  }
  if (input.content.length > CANVAS_CONTENT_MAX_CHARS) {
    throw new ClientError(
      "That canvas is larger than the canvas size limit.",
      400,
      "canvas_too_large",
    );
  }
  const nextVersion = existing.currentVersion + 1;
  // Sequential writes (single-owner canvas, same pattern as chat turns).
  await prisma.chatCanvasVersion.create({
    data: {
      canvasId: input.canvasId,
      version: nextVersion,
      kind: "user",
      content: input.content,
    },
  });
  const row = (await prisma.chatCanvas.update({
    where: { id: input.canvasId },
    data: { title, content: input.content, currentVersion: nextVersion },
  })) as CanvasRow;
  return serializeChatCanvas(row);
}

export async function deleteChatCanvas(userId: string, canvasId: string) {
  await loadOwnedCanvas(userId, canvasId);
  await prisma.chatCanvas.delete({ where: { id: canvasId } });
}

export async function restoreChatCanvasVersion(input: {
  userId: string;
  canvasId: string;
  versionId: string;
}) {
  const existing = await loadOwnedCanvas(input.userId, input.canvasId);
  const target = (await prisma.chatCanvasVersion.findFirst({
    where: { id: input.versionId, canvasId: input.canvasId },
  })) as (CanvasVersionRow & { content: string }) | null;
  if (!target) throw new ClientError("Version not found.", 404, "not_found");
  if (target.version === existing.currentVersion) {
    return serializeChatCanvas(existing);
  }
  const nextVersion = existing.currentVersion + 1;
  await prisma.chatCanvasVersion.create({
    data: {
      canvasId: input.canvasId,
      version: nextVersion,
      kind: "restore",
      content: target.content,
      instruction: `Restored version ${target.version}`,
    },
  });
  const row = (await prisma.chatCanvas.update({
    where: { id: input.canvasId },
    data: { content: target.content, currentVersion: nextVersion },
  })) as CanvasRow;
  return serializeChatCanvas(row);
}

export type CanvasAiEditResult =
  | {
      status: "applied";
      canvas: ChatCanvasDTO;
      summary: string;
      appliedCount: number;
      skippedCount: number;
      skippedReasons: string[];
      version: number;
    }
  | { status: "refused"; refusal: string };

/**
 * One AI edit turn against a canvas. The instruction and the outcome are
 * persisted as chat messages on the owning conversation, so the thread
 * stays the record of the work — exactly like asking in chat.
 */
export async function aiEditChatCanvas(input: {
  userId: string;
  userEmail: string;
  canvasId: string;
  instruction: string;
  modelId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<CanvasAiEditResult> {
  const instruction = input.instruction.trim();
  if (!instruction) {
    throw new ClientError("Describe the change you want.", 400, "invalid_request");
  }
  const canvas = await loadOwnedCanvas(input.userId, input.canvasId);
  const workspace = await prisma.workspace.findUnique({
    where: { id: canvas.workspaceId },
    select: { id: true, plan: true },
  });
  if (!workspace) throw new ClientError("Workspace not found.", 404, "not_found");

  // Safety gate — identical policy to the chat stream: a flagged
  // instruction is refused, logged for the admin panel, and never sent
  // to a provider. The refusal is persisted as the assistant reply.
  const verdict = classifySafety(instruction);
  if (verdict.flagged && verdict.category) {
    await recordSafetyAlert({
      verdict,
      message: instruction,
      userId: input.userId,
      userEmail: input.userEmail,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    }).catch(() => undefined);
    const refusal = safetyRefusal(verdict.category, instruction);
    await prisma.chatMessage.create({
      data: {
        conversationId: canvas.conversationId,
        role: "user",
        content: instruction,
      },
    });
    await prisma.chatMessage.create({
      data: {
        conversationId: canvas.conversationId,
        role: "assistant",
        content: refusal,
        model: "safety-moderation",
        provider: "cinem-safety",
        tokens: 0,
      },
    });
    await prisma.chatConversation.update({
      where: { id: canvas.conversationId },
      data: { updatedAt: new Date() },
    });
    return { status: "refused", refusal };
  }

  // Honest not-configured gate, mirroring the chat stream's wording: a
  // picked model whose provider has no key never silently swaps.
  const resolution = resolveChatRoutes(input.modelId, workspace.plan);
  if (!resolution.ok) {
    const who = resolution.provider
      ? chatProviderLabel(resolution.provider)
      : "any AI provider";
    const what = resolution.displayName
      ? `"${resolution.displayName}" is not configured yet`
      : "No AI model is configured yet";
    throw new ClientError(
      `${what} — the ${who} API key has not been added to the server environment. Other models may still work.`,
      503,
      "model_not_configured",
    );
  }
  await assertLlmCallBudget(workspace.id, "chat");

  if (canvas.content.length > CANVAS_AI_EDIT_MAX_CHARS) {
    throw new ClientError(
      "This canvas is too large for one AI edit. Split it into a smaller canvas, or edit it directly — your text is unchanged.",
      400,
      "canvas_too_large_for_ai_edit",
    );
  }

  const split = splitCanvasBlocks(canvas.content);
  let result: Awaited<ReturnType<typeof llm.complete>>;
  try {
    result = await runWithLlmRouting(
      {
        prefer: input.modelId,
        plan: workspace.plan,
        workspaceId: workspace.id,
        budgetMode: "chat",
      },
      () =>
        llm.complete({
          mode: "final",
          kind: "json",
          json: true,
          messages: [
            { role: "system", content: CANVAS_EDIT_SYSTEM_PROMPT },
            {
              role: "user",
              content: buildCanvasEditUserPrompt({
                title: canvas.title,
                kind: canvas.kind,
                language: canvas.language,
                blocks: split.blocks,
                instruction,
              }),
            },
          ],
        }),
    );
  } catch (error) {
    if (error instanceof Error && error.message === "NO_LLM_KEYS") {
      throw new ClientError(
        "No AI model is configured yet — the API key has not been added to the server environment.",
        503,
        "model_not_configured",
      );
    }
    throw error;
  }
  if (result.demo || !result.text.trim()) {
    throw new ClientError(
      "No AI model is configured yet — the API key has not been added to the server environment.",
      503,
      "model_not_configured",
    );
  }

  const parsed = parseCanvasEditResponse(result.text);
  if (!parsed || parsed.edits.length === 0) {
    throw new ClientError(
      "The AI's suggested edit could not be applied cleanly, so your canvas was left unchanged. Try rephrasing the instruction.",
      422,
      "edit_not_applied",
    );
  }
  const applied = applyCanvasEditOps(split, parsed.edits);
  if (applied.appliedCount === 0 || !applied.content.trim()) {
    const reasons = applied.outcomes
      .filter((row) => !row.applied && row.reason)
      .map((row) => row.reason as string)
      .slice(0, 2)
      .join("; ");
    throw new ClientError(
      `The AI's suggested edit could not be applied cleanly, so your canvas was left unchanged.${reasons ? ` (${reasons})` : ""} Try rephrasing the instruction.`,
      422,
      "edit_not_applied",
    );
  }
  if (applied.content.length > CANVAS_CONTENT_MAX_CHARS) {
    throw new ClientError(
      "That edit would make the canvas larger than the canvas size limit, so it was not applied.",
      400,
      "canvas_too_large",
    );
  }

  const nextVersion = canvas.currentVersion + 1;
  const skippedReasons = applied.outcomes
    .filter((row) => !row.applied && row.reason)
    .map((row) => row.reason as string);

  // Sequential writes: version row, canvas head, then the chat record.
  await prisma.chatCanvasVersion.create({
    data: {
      canvasId: canvas.id,
      version: nextVersion,
      kind: "ai",
      content: applied.content,
      instruction,
      model: result.model,
      provider: result.provider,
      tokens: result.tokens,
    },
  });
  const updated = (await prisma.chatCanvas.update({
    where: { id: canvas.id },
    data: { content: applied.content, currentVersion: nextVersion },
  })) as CanvasRow;

  const summaryText =
    parsed.summary ||
    `Applied ${applied.appliedCount} edit${applied.appliedCount === 1 ? "" : "s"} to the canvas.`;
  const assistantNote = `${summaryText}\n\n(Canvas “${canvas.title}” is now version ${nextVersion} — ${applied.appliedCount} edit${applied.appliedCount === 1 ? "" : "s"} applied${applied.skippedCount ? `, ${applied.skippedCount} suggested edit${applied.skippedCount === 1 ? "" : "s"} could not be matched and ${applied.skippedCount === 1 ? "was" : "were"} skipped` : ""}.)`;
  await prisma.chatMessage.create({
    data: {
      conversationId: canvas.conversationId,
      role: "user",
      content: instruction,
    },
  });
  await prisma.chatMessage.create({
    data: {
      conversationId: canvas.conversationId,
      role: "assistant",
      content: assistantNote,
      model: result.model,
      provider: result.provider,
      tokens: result.tokens,
    },
  });
  await prisma.chatConversation.update({
    where: { id: canvas.conversationId },
    data: { updatedAt: new Date() },
  });
  await recordUsage({
    workspaceId: workspace.id,
    tokens: result.tokens,
    model: result.model,
    agentRole: "chat-canvas",
    bucket: "chat",
  });

  return {
    status: "applied",
    canvas: serializeChatCanvas(updated),
    summary: parsed.summary,
    appliedCount: applied.appliedCount,
    skippedCount: applied.skippedCount,
    skippedReasons,
    version: nextVersion,
  };
}
