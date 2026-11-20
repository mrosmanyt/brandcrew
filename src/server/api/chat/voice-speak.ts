import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { resolveChatWorkspace } from "@/lib/chat";
import { jsonError, jsonFail } from "@/lib/http";
import { recordUsage, assertLlmCallBudget } from "@/lib/usage";
import {
  synthesizeSpeech,
  voiceConfigured,
  VOICE_NOT_CONFIGURED_MESSAGE,
  VOICE_SPEAK_MAX_CHARS,
  VOICE_USAGE_TOKENS,
} from "@/lib/voice";

const postSchema = z.object({
  text: z.string().min(1).max(VOICE_SPEAK_MAX_CHARS * 2),
});

/**
 * POST /api/chat/voice/speak — reply text → spoken audio (OpenAI TTS).
 * Returns the MP3 bytes directly. 503 `voice_not_configured` when the
 * OpenAI key is missing.
 */
export async function POST(request: Request) {
  try {
    const user = await requireUser();
    if (!voiceConfigured()) {
      return NextResponse.json(
        { error: VOICE_NOT_CONFIGURED_MESSAGE, code: "voice_not_configured" },
        { status: 503 },
      );
    }
    const body = postSchema.parse(await request.json());
    const workspace = await resolveChatWorkspace(user.id, user.name);
    await assertLlmCallBudget(workspace.id, "chat");
    const { bytes, contentType } = await synthesizeSpeech({ text: body.text });
    await recordUsage({
      workspaceId: workspace.id,
      tokens: VOICE_USAGE_TOKENS,
      model: "tts-1",
      agentRole: "voice",
      bucket: "chat",
    });
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonFail("There is nothing to read aloud.", 400);
    }
    return jsonError(error);
  }
}
