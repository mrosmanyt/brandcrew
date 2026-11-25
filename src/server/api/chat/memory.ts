import { z } from "zod";
import { requireUser } from "@/lib/auth";
import {
  addMemoryFact,
  getChatMemory,
  setCustomInstructions,
  setResponseLanguage,
  CUSTOM_INSTRUCTIONS_MAX,
  MEMORY_FACT_MAX,
} from "@/lib/chat-memory";
import { CHAT_LANGUAGE_MODES } from "@/lib/chat-language";
import { jsonError, jsonOk } from "@/lib/http";

const postSchema = z.object({
  fact: z.string().trim().min(1).max(MEMORY_FACT_MAX),
});

const patchSchema = z
  .object({
    customInstructions: z.string().max(CUSTOM_INSTRUCTIONS_MAX).optional(),
    responseLanguage: z.enum(CHAT_LANGUAGE_MODES).optional(),
  })
  .refine(
    (body) =>
      body.customInstructions !== undefined ||
      body.responseLanguage !== undefined,
    { message: "Nothing to update." },
  );

/** GET /api/chat/memory — the user's custom instructions + saved facts. */
export async function GET() {
  try {
    const user = await requireUser();
    return jsonOk(await getChatMemory(user.id));
  } catch (error) {
    return jsonError(error);
  }
}

/** POST /api/chat/memory — save one fact the user wrote themselves. */
export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = postSchema.parse(await request.json());
    const fact = await addMemoryFact(user.id, body.fact);
    return jsonOk({ fact });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonError(new Error("Write the fact you want remembered."));
    }
    return jsonError(error);
  }
}

/** PATCH /api/chat/memory — update custom instructions and/or reply language. */
export async function PATCH(request: Request) {
  try {
    const user = await requireUser();
    const body = patchSchema.parse(await request.json());
    const updated: {
      customInstructions?: string;
      responseLanguage?: string;
    } = {};
    if (body.customInstructions !== undefined) {
      updated.customInstructions = await setCustomInstructions(
        user.id,
        body.customInstructions,
      );
    }
    if (body.responseLanguage !== undefined) {
      updated.responseLanguage = await setResponseLanguage(
        user.id,
        body.responseLanguage,
      );
    }
    return jsonOk(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonError(new Error("Those instructions are too long."));
    }
    return jsonError(error);
  }
}
