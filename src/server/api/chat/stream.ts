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
import {
  buildResearchContext,
  mergeResearchSources,
  parseSubQuestions,
  RESEARCH_PLAN_INSTRUCTION,
  RESEARCH_PLAN_SYSTEM_PROMPT,
  RESEARCH_REPORT_SYSTEM_PROMPT,
} from "@/lib/deep-research";

const postSchema = z.object({
  conversationId: z.string().min(1).nullable().optional(),
  modelId: z.enum(LLM_ROUTING_PREFERENCES),
  /** When true, the latest question is web-searched (Tavily) before the turn. */
  webSearch: z.boolean().optional(),
  /** Deep research: plan sub-questions, run several searches, write a cited report. */
  deepResearch: z.boolean().optional(),
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
  let routes: LlmRoute[];
  let searchContext = "";
  let searchSources: ChatSearchSource[] = [];
  let systemPrompt = CHAT_SYSTEM_PROMPT;
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
    if (body.deepResearch) {
      // Deep research runs its own searches inside the stream (below), so
      // only the honest not-configured gate happens pre-stream — the same
      // message web search uses. The model gate above already ran.
      if (!chatSearchConfigured()) {
        return NextResponse.json(
          { error: SEARCH_NOT_CONFIGURED_MESSAGE, code: "search_not_configured" },
          { status: 503 },
        );
      }
    } else if (body.webSearch) {
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
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonFail("Write a message to start the chat.", 400);
    }
    return jsonError(error);
  }

  const { workspaceId, conversation } = prepared;
  let planningTokens = 0;
  let history: LlmChatMessage[] = [
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
        if (body.deepResearch) {
          const question =
            body.messages[body.messages.length - 1]?.content ?? "";
          send("progress", {
            stage: "planning",
            label: "Planning the research…",
          });
          let planText = "";
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
                  messages: [
                    { role: "system", content: RESEARCH_PLAN_SYSTEM_PROMPT },
                    {
                      role: "user",
                      content: `${question}\n\n${RESEARCH_PLAN_INSTRUCTION}`,
                    },
                  ],
                  routes,
                  signal: abort.signal,
                })) {
                  if (event.type === "delta") planText += event.text;
                  else planningTokens = event.meta.tokens;
                }
              },
            );
          } catch {
            // Planning is best-effort: if it fails, parseSubQuestions falls
            // back to researching the raw question itself.
            planText = "";
          }
          const subQuestions = parseSubQuestions(planText, question);
          const batches: Array<{
            sources: ChatSearchSource[];
            excerpts: string[];
          }> = [];
          for (let i = 0; i < subQuestions.length; i += 1) {
            send("progress", {
              stage: "searching",
              label: `Searching ${i + 1} of ${subQuestions.length}: ${subQuestions[i]}`,
            });
            const result = await searchForChat(subQuestions[i]);
            // One search charge per Tavily call made — same flat rate and
            // recordUsage path as a normal chat search.
            await recordUsage({
              workspaceId,
              tokens: SEARCH_USAGE_TOKENS,
              model: "tavily-search",
              agentRole: "chat-search",
              bucket: "chat",
            }).catch(() => null);
            if (result.ok) {
              batches.push({
                sources: result.sources,
                excerpts: result.excerpts,
              });
            }
          }
          const merged = mergeResearchSources(batches);
          if (!merged.length) {
            send("error", {
              error:
                "The research searches returned no results. Try rephrasing the question.",
              code: "search_failed",
            });
            return;
          }
          searchSources = merged.map((source) => ({
            title: source.title,
            url: source.url,
          }));
          send("sources", { sources: searchSources });
          history = [
            { role: "system", content: systemPrompt },
            {
              role: "system",
              content: `${RESEARCH_REPORT_SYSTEM_PROMPT}\n\n${buildResearchContext(question, subQuestions, merged)}`,
            },
            ...body.messages.map((message) => ({
              role: message.role,
              content:
                message.role === "user"
                  ? chatContentWithAttachments(
                      message.content,
                      message.attachments,
                    )
                  : message.content,
            })),
          ];
          send("progress", { stage: "writing", label: "Writing the report…" });
        }
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
            tokens: state.meta.tokens + planningTokens,
            ...(searchSources.length ? { sources: searchSources } : {}),
          });
          send("done", {
            conversationId: conversation.id,
            messageId: saved.id,
            model: state.meta.model,
            provider: state.meta.provider,
            displayName: state.meta.displayName,
            tokens: state.meta.tokens + planningTokens,
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
              (state.meta?.tokens ??
                Math.ceil(state.text.split(/\s+/).filter(Boolean).length * 1.3)) +
              planningTokens,
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
