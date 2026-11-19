import { z } from "zod";
import { requireUser } from "@/lib/auth";
import {
  createChatConversation,
  listChatConversations,
} from "@/lib/chat";
import { jsonError, jsonOk } from "@/lib/http";
import { LLM_ROUTING_PREFERENCES } from "@/lib/llm-routing";

const createSchema = z.object({
  title: z.string().trim().max(120).optional(),
  modelId: z.enum(LLM_ROUTING_PREFERENCES).optional(),
});

export async function GET() {
  try {
    const user = await requireUser();
    return jsonOk({ conversations: await listChatConversations(user.id) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = createSchema.parse(await request.json().catch(() => ({})));
    const conversation = await createChatConversation({
      userId: user.id,
      userName: user.name,
      title: body.title,
      modelId: body.modelId,
    });
    return jsonOk({ conversation }, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonError(new Error("Invalid conversation payload."));
    }
    return jsonError(error);
  }
}
