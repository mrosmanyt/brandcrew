import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { restoreChatCanvasVersion } from "@/lib/chat-canvas";
import { jsonError, jsonOk } from "@/lib/http";

type Ctx = { params: Promise<{ canvasId: string }> };

const postSchema = z.object({
  versionId: z.string().trim().min(1).max(64),
});

export async function POST(request: Request, context: Ctx) {
  try {
    const user = await requireUser();
    const { canvasId } = await context.params;
    const body = postSchema.parse(await request.json());
    const canvas = await restoreChatCanvasVersion({
      userId: user.id,
      canvasId,
      versionId: body.versionId,
    });
    return jsonOk({ canvas });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonError(new Error("Invalid restore payload."));
    }
    return jsonError(error);
  }
}
