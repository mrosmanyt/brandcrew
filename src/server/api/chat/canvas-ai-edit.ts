import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { aiEditChatCanvas } from "@/lib/chat-canvas";
import { jsonError, jsonOk } from "@/lib/http";
import { LLM_ROUTING_PREFERENCES } from "@/lib/llm-routing";
import { clientIp } from "@/lib/rate-limit";

type Ctx = { params: Promise<{ canvasId: string }> };

const postSchema = z.object({
  instruction: z.string().trim().min(1).max(4_000),
  modelId: z.enum(LLM_ROUTING_PREFERENCES),
});

export async function POST(request: Request, context: Ctx) {
  try {
    const user = await requireUser();
    const { canvasId } = await context.params;
    const body = postSchema.parse(await request.json());
    const result = await aiEditChatCanvas({
      userId: user.id,
      userEmail: user.email,
      canvasId,
      instruction: body.instruction,
      modelId: body.modelId,
      ipAddress: clientIp(request),
      userAgent: request.headers.get("user-agent"),
    });
    return jsonOk(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonError(new Error("Invalid AI edit payload."));
    }
    return jsonError(error);
  }
}
