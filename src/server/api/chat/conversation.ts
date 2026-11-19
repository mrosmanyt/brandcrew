import { z } from "zod";
import { requireUser } from "@/lib/auth";
import {
  deleteChatConversation,
  getChatConversation,
  renameChatConversation,
} from "@/lib/chat";
import { jsonError, jsonOk } from "@/lib/http";
import { LLM_ROUTING_PREFERENCES } from "@/lib/llm-routing";

type Ctx = { params: Promise<{ conversationId: string }> };

const patchSchema = z.object({
  title: z.string().trim().max(120).optional(),
  modelId: z.enum(LLM_ROUTING_PREFERENCES).nullable().optional(),
});

export async function GET(_request: Request, context: Ctx) {
  try {
    const user = await requireUser();
    const { conversationId } = await context.params;
    return jsonOk(await getChatConversation(user.id, conversationId));
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request, context: Ctx) {
  try {
    const user = await requireUser();
    const { conversationId } = await context.params;
    const body = patchSchema.parse(await request.json());
    const conversation = await renameChatConversation(user.id, conversationId, body);
    return jsonOk({ conversation });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonError(new Error("Invalid conversation update."));
    }
    return jsonError(error);
  }
}

export async function DELETE(_request: Request, context: Ctx) {
  try {
    const user = await requireUser();
    const { conversationId } = await context.params;
    await deleteChatConversation(user.id, conversationId);
    return jsonOk({ deleted: true });
  } catch (error) {
    return jsonError(error);
  }
}
