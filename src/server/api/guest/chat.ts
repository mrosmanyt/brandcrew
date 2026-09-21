import { NextResponse } from "next/server";
import { z } from "zod";
import { answerGuestChat, normalizeGuestKey } from "@/lib/guest-chat";
import { GUEST_CHAT_MESSAGE_MAX } from "@/lib/guest-chat-pure";
import { jsonError, jsonOk, recordJsonErrorCode } from "@/lib/http";
import { LLM_ROUTING_PREFERENCES } from "@/lib/llm-routing";
import { enforceSensitiveRateLimit } from "@/lib/rate-limit";

const postSchema = z.object({
  message: z.string().trim().min(1).max(GUEST_CHAT_MESSAGE_MAX),
  guestKey: z.string().trim().max(64).optional(),
  modelRouting: z.enum(LLM_ROUTING_PREFERENCES).optional(),
  history: z
    .array(
      z.object({
        id: z.string(),
        role: z.enum(["user", "assistant"]),
        content: z.string().max(GUEST_CHAT_MESSAGE_MAX),
        createdAt: z.string(),
      }),
    )
    .max(24)
    .optional(),
});

function guestKeyFrom(request: Request, bodyKey?: string) {
  return (
    normalizeGuestKey(bodyKey) ||
    normalizeGuestKey(request.headers.get("x-cinem-guest-key")) ||
    ""
  );
}

export async function GET() {
  const { llm } = await import("@/lib/llm");
  const { GUEST_CHAT_MESSAGE_LIMIT } = await import("@/lib/guest-chat-pure");
  return jsonOk({
    llm: llm.status(),
    limit: GUEST_CHAT_MESSAGE_LIMIT,
    defaultLocale: "en",
  });
}

export async function POST(request: Request) {
  try {
    await enforceSensitiveRateLimit(request, ["api", "guest", "chat"], "POST");
    const body = postSchema.parse(await request.json());
    void import("@/lib/analytics")
      .then((mod) => mod.recordGuestChatTopics(body.message))
      .catch(() => undefined);
    const result = await answerGuestChat({
      request,
      guestKey: guestKeyFrom(request, body.guestKey),
      message: body.message,
      history: body.history,
      modelRouting: body.modelRouting,
    });
    return jsonOk(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Write a short message to continue.", code: "invalid_request" },
        { status: 400 },
      );
    }
    recordJsonErrorCode(error);
    return jsonError(error);
  }
}
