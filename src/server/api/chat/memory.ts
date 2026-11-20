import { z } from "zod";
import { requireUser } from "@/lib/auth";
import {
  addMemoryFact,
  getChatMemory,
  setCustomInstructions,
  CUSTOM_INSTRUCTIONS_MAX,
  MEMORY_FACT_MAX,
} from "@/lib/chat-memory";
import { jsonError, jsonOk } from "@/lib/http";

const postSchema = z.object({
  fact: z.string().trim().min(1).max(MEMORY_FACT_MAX),
});

const patchSchema = z.object({
  customInstructions: z.string().max(CUSTOM_INSTRUCTIONS_MAX),
});

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

/** PATCH /api/chat/memory — replace the custom instructions. */
export async function PATCH(request: Request) {
  try {
    const user = await requireUser();
    const body = patchSchema.parse(await request.json());
    const customInstructions = await setCustomInstructions(
      user.id,
      body.customInstructions,
    );
    return jsonOk({ customInstructions });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonError(new Error("Those instructions are too long."));
    }
    return jsonError(error);
  }
}
