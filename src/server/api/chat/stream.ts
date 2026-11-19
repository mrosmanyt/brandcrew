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
import { jsonError, jsonFail } from "@/lib/http";
import {
  llm,
  runWithLlmRouting,
  type LlmChatMessage,
  type LlmRoute,
  type LlmStreamMeta,
} from "@/lib/llm";
import { LLM_ROUTING_PREFERENCES } from "@/lib/llm-routing";
import { assertLlmCallBudget, BudgetError } from "@/lib/usage";

const postSchema = z.object({
  conversationId: z.string().min(1).nullable().optional(),
  modelId: z.enum(LLM_ROUTING_PREFERENCES),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(CHAT_MESSAGE_MAX),
      }),
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
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonFail("Write a message to start the chat.", 400);
    }
    return jsonError(error);
  }

  const { workspaceId, conversation } = prepared;
  const history: LlmChatMessage[] = [
    { role: "system", content: CHAT_SYSTEM_PROMPT },
    ...body.messages.map((message) => ({
      role: message.role,
      content: message.content,
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
