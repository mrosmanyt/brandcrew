import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import {
  CHAT_SYSTEM_PROMPT,
  chatProviderLabel,
  persistChatReply,
  prepareChatTurn,
  resolveChatRoutes,
  type PreparedChatTurn,
} from "@/lib/chat";
import {
  CHAT_HISTORY_MAX,
  CHAT_MESSAGE_MAX,
  encodeSseEvent,
  type ChatSseEventName,
} from "@/lib/chat-stream-pure";
import {
  chatContentWithAttachments,
  composerAttachmentsSchema,
} from "@/lib/composer-media";
import { jsonError, jsonFail } from "@/lib/http";
import {
  llm,
  runWithLlmRouting,
  type LlmChatMessage,
  type LlmRoute,
  type LlmStreamMeta,
} from "@/lib/llm";
import { LLM_ROUTING_PREFERENCES } from "@/lib/llm-routing";
import { assertLlmCallBudget, BudgetError, recordUsage } from "@/lib/usage";
import {
  chatSearchConfigured,
  searchForChat,
  SEARCH_NOT_CONFIGURED_MESSAGE,
  SEARCH_USAGE_TOKENS,
  type ChatSearchSource,
} from "@/lib/chat-search";
import { buildMemorySystemBlock } from "@/lib/chat-memory";
import {
  CHAT_LANGUAGE_MODES,
  languageModeSystemBlock,
} from "@/lib/chat-language";
import { classifySafety, safetyRefusal } from "@/lib/safety-moderation";
import { recordSafetyAlert } from "@/lib/safety-alerts";
import { clientIp } from "@/lib/rate-limit";

const postSchema = z.object({
  conversationId: z.string().min(1).nullable().optional(),
  modelId: z.enum(LLM_ROUTING_PREFERENCES),
  /** When true, the latest question is web-searched (Tavily) before the turn. */
  webSearch: z.boolean().optional(),
  /** Reply language mode: auto mirrors the user; ur / roman-ur pin Urdu. */
  languageMode: z.enum(CHAT_LANGUAGE_MODES).optional(),
  messages: z
    .array(
      z
        .object({
          role: z.enum(["user", "assistant"]),
          // Text may be empty when the message carries attachments
          // (a photo with no caption is a complete message).
          content: z.string().max(CHAT_MESSAGE_MAX),
          attachments: composerAttachmentsSchema,
        })
        .refine(
          (message) =>
            message.content.trim().length > 0 || message.attachments.length > 0,
          { message: "Write a message or attach a file." },
        ),
    )
    .min(1)
    .max(CHAT_HISTORY_MAX),
});

type ChatStreamBody = z.infer<typeof postSchema>;

/**
 * POST /api/chat/stream — one chat turn, streamed as SSE.
 *
 * Pre-stream failures (auth, validation, budget, model-not-configured)
 * return plain JSON errors with real HTTP statuses. Once the SSE stream
 * opens, failures arrive as an "error" event; any partial assistant text
 * the user already saw is persisted so stored history matches the screen.
 */
export async function POST(request: Request) {
  let body: ChatStreamBody;
  let prepared: PreparedChatTurn;
  let routes: LlmRoute[] = [];
  let searchContext = "";
  let searchSources: ChatSearchSource[] = [];
  let systemPrompt = CHAT_SYSTEM_PROMPT;
  // Set when the safety classifier refuses the turn: the refusal reply is
  // persisted inside the try block and replayed as a short SSE stream
  // after it. The harmful message never reaches a model.
  let safetyBlock: {
    refusal: string;
    messageId: string;
    conversationId: string;
    userMessageId: string | null;
  } | null = null;
  try {
    const user = await requireUser();
    body = postSchema.parse(await request.json());
    const last = body.messages[body.messages.length - 1];
    if (!last || last.role !== "user") {
      return jsonFail("The last message must be from you.", 400);
    }
    prepared = await prepareChatTurn({
      userId: user.id,
      userName: user.name,
      conversationId: body.conversationId,
      modelId: body.modelId,
      messages: body.messages,
    });
    // Safety gate (owner directive, 2026-11-25): classify the new user
    // message BEFORE any model routing, budget spend or web search. A
    // flagged message is refused, logged as a SafetyAlert for the admin
    // panel, and never sent to a provider.
    const verdict = classifySafety(last.content);
    if (verdict.flagged && verdict.category) {
      await recordSafetyAlert({
        verdict,
        message: last.content,
        userId: user.id,
        userEmail: user.email,
        ipAddress: clientIp(request),
        userAgent: request.headers.get("user-agent"),
      }).catch(() => undefined);
      const refusal = safetyRefusal(verdict.category, last.content);
      const saved = await persistChatReply({
        conversationId: prepared.conversation.id,
        workspaceId: prepared.workspaceId,
        content: refusal,
        model: "safety-moderation",
        provider: "cinem-safety",
        tokens: 0,
      });
      safetyBlock = {
        refusal,
        messageId: saved.id,
        conversationId: prepared.conversation.id,
        userMessageId: prepared.userMessageId,
      };
    }
    if (!safetyBlock) {
      const resolution = resolveChatRoutes(body.modelId, prepared.plan);
      if (!resolution.ok) {
        const who = resolution.provider
          ? chatProviderLabel(resolution.provider)
          : "any AI provider";
        const what = resolution.displayName
          ? `"${resolution.displayName}" is not configured yet`
          : "No AI model is configured yet";
        return NextResponse.json(
          {
            error: `${what} — the ${who} API key has not been added to the server environment. Other models may still work.`,
            code: "model_not_configured",
            provider: resolution.provider,
          },
          { status: 503 },
        );
      }
      routes = resolution.routes;
      // Pre-flight budget check: an exhausted plan fails as a clean 429 JSON
      // response instead of an SSE stream that dies on its first event.
      await assertLlmCallBudget(prepared.workspaceId, "chat");
      // Memory + custom instructions ride the system prompt. A memory read
      // failure must never break the chat itself, so it degrades to none.
      try {
        const memoryBlock = await buildMemorySystemBlock(user.id);
        if (memoryBlock) systemPrompt = `${CHAT_SYSTEM_PROMPT}\n\n${memoryBlock}`;
      } catch {
        // No memory this turn; the chat continues without it.
      }
      const languageBlock = body.languageMode
        ? languageModeSystemBlock(body.languageMode)
        : null;
      if (languageBlock) systemPrompt = `${systemPrompt}\n\n${languageBlock}`;
      if (body.webSearch) {
        // Search runs before the stream opens so a missing/rejected key or a
        // failed search is an honest JSON error, not a mid-stream surprise.
        if (!chatSearchConfigured()) {
          return NextResponse.json(
            { error: SEARCH_NOT_CONFIGURED_MESSAGE, code: "search_not_configured" },
            { status: 503 },
          );
        }
        const searched = await searchForChat(last.content);
        if (!searched.ok) {
          return NextResponse.json(
            {
              error: searched.error || "Web search failed. Try again.",
              code: "search_failed",
            },
            { status: 502 },
          );
        }
        searchContext = searched.contextText;
        searchSources = searched.sources;
        await recordUsage({
          workspaceId: prepared.workspaceId,
          tokens: SEARCH_USAGE_TOKENS,
          model: "tavily-search",
          agentRole: "chat-search",
          bucket: "chat",
        });
      }
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonFail("Write a message to start the chat.", 400);
    }
    return jsonError(error);
  }

  if (safetyBlock) {
    // Refused turn: replay the already-persisted refusal as a complete
    // SSE turn so the client renders it like any other assistant reply.
    const encoder = new TextEncoder();
    const block = safetyBlock;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            encodeSseEvent("start", {
              conversationId: block.conversationId,
              userMessageId: block.userMessageId,
            }),
          ),
        );
        controller.enqueue(
          encoder.encode(encodeSseEvent("delta", { text: block.refusal })),
        );
        controller.enqueue(
          encoder.encode(
            encodeSseEvent("done", {
              conversationId: block.conversationId,
              messageId: block.messageId,
              model: "safety-moderation",
              provider: "cinem-safety",
              displayName: "CINEM Pro Safety",
              tokens: 0,
            }),
          ),
        );
        controller.close();
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  }

  const { workspaceId, conversation } = prepared;
  const history: LlmChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...(searchContext
      ? [{ role: "system", content: searchContext } as LlmChatMessage]
      : []),
    ...body.messages.map((message) => ({
      role: message.role,
      content:
        message.role === "user"
          ? chatContentWithAttachments(message.content, message.attachments)
          : message.content,
    })),
  ];

  const encoder = new TextEncoder();
  const abort = new AbortController();
  try {
    request.signal.addEventListener("abort", () => abort.abort(), {
      once: true,
    });
  } catch {
    // Request signal unavailable in this runtime; stream cancel still aborts.
  }

  const state: { text: string; meta: LlmStreamMeta | null } = {
    text: "",
    meta: null,
  };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: ChatSseEventName, data: unknown) => {
        try {
          controller.enqueue(encoder.encode(encodeSseEvent(event, data)));
        } catch {
          // Client went away mid-stream; persistence below still runs.
        }
      };
      send("start", {
        conversationId: conversation.id,
        userMessageId: prepared.userMessageId,
      });
      if (searchSources.length) {
        send("sources", { sources: searchSources });
      }
      try {
        await runWithLlmRouting(
          {
            prefer: body.modelId,
            plan: prepared.plan,
            workspaceId,
            budgetMode: "chat",
          },
          async () => {
            for await (const event of llm.streamComplete({
              mode: "final",
              kind: "general",
              messages: history,
              routes,
              signal: abort.signal,
            })) {
              if (event.type === "delta") {
                state.text += event.text;
                send("delta", { text: event.text });
              } else {
                state.meta = event.meta;
              }
            }
          },
        );
        if (state.meta) {
          const saved = await persistChatReply({
            conversationId: conversation.id,
            workspaceId,
            content: state.text,
            model: state.meta.model,
            provider: state.meta.provider,
            tokens: state.meta.tokens,
            ...(searchSources.length ? { sources: searchSources } : {}),
          });
          send("done", {
            conversationId: conversation.id,
            messageId: saved.id,
            model: state.meta.model,
            provider: state.meta.provider,
            displayName: state.meta.displayName,
            tokens: state.meta.tokens,
          });
        } else {
          send("error", {
            error: "The model returned an empty reply. Try again.",
            code: "empty_reply",
          });
        }
      } catch (error) {
        if (state.text.trim()) {
          // Keep stored history consistent with what the user already saw.
          await persistChatReply({
            conversationId: conversation.id,
            workspaceId,
            content: state.text,
            model: state.meta?.model ?? routes[0]?.model ?? "demo",
            provider: state.meta?.provider ?? routes[0]?.provider ?? "demo",
            tokens:
              state.meta?.tokens ??
              Math.ceil(state.text.split(/\s+/).filter(Boolean).length * 1.3),
            ...(searchSources.length ? { sources: searchSources } : {}),
          }).catch(() => null);
        }
        send("error", {
          error:
            error instanceof Error
              ? error.message
              : "The reply stopped unexpectedly.",
          code: error instanceof BudgetError ? error.code : "stream_failed",
        });
      } finally {
        try {
          controller.close();
        } catch {
          // Already closed by the runtime.
        }
      }
    },
    cancel() {
      abort.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
