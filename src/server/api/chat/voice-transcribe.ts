import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { resolveChatWorkspace } from "@/lib/chat";
import { jsonError, jsonFail } from "@/lib/http";
import { recordUsage, assertLlmCallBudget } from "@/lib/usage";
import {
  transcribeVoiceNote,
  voiceConfigured,
  VOICE_AUDIO_MAX_BYTES,
  VOICE_NOT_CONFIGURED_MESSAGE,
  VOICE_USAGE_TOKENS,
} from "@/lib/voice";

const postSchema = z.object({
  /** Base64-encoded audio bytes (no data: prefix). */
  audio: z.string().min(1),
  mime: z.string().min(1).max(80),
});

/**
 * POST /api/chat/voice/transcribe — one voice note → text (Whisper).
 * Returns 503 `voice_not_configured` when the OpenAI key is missing, so
 * the composer can say so honestly instead of pretending to listen.
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
    const bytes = Buffer.from(body.audio, "base64");
    if (!bytes.length) return jsonFail("No audio was received.", 400);
    if (bytes.length > VOICE_AUDIO_MAX_BYTES) {
      return jsonFail("That recording is too long. Keep it under a few minutes.", 413);
    }
    const workspace = await resolveChatWorkspace(user.id, user.name);
    await assertLlmCallBudget(workspace.id, "chat");
    const { text } = await transcribeVoiceNote({ bytes, mime: body.mime });
    await recordUsage({
      workspaceId: workspace.id,
      tokens: VOICE_USAGE_TOKENS,
      model: "whisper-1",
      agentRole: "voice",
      bucket: "chat",
    });
    return NextResponse.json({ text });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonFail("That recording could not be read.", 400);
    }
    return jsonError(error);
  }
}
