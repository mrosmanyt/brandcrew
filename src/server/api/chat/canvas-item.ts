import { z } from "zod";
import { requireUser } from "@/lib/auth";
import {
  deleteChatCanvas,
  getChatCanvas,
  saveChatCanvas,
} from "@/lib/chat-canvas";
import {
  CANVAS_CONTENT_MAX_CHARS,
  CANVAS_TITLE_MAX,
} from "@/lib/chat-canvas-pure";
import { jsonError, jsonOk } from "@/lib/http";

type Ctx = { params: Promise<{ canvasId: string }> };

const patchSchema = z.object({
  title: z.string().trim().max(CANVAS_TITLE_MAX).optional(),
  content: z.string().max(CANVAS_CONTENT_MAX_CHARS).optional(),
});

export async function GET(_request: Request, context: Ctx) {
  try {
    const user = await requireUser();
    const { canvasId } = await context.params;
    return jsonOk(await getChatCanvas(user.id, canvasId));
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request, context: Ctx) {
  try {
    const user = await requireUser();
    const { canvasId } = await context.params;
    const body = patchSchema.parse(await request.json());
    const canvas = await saveChatCanvas({
      userId: user.id,
      canvasId,
      title: body.title,
      content: body.content,
    });
    return jsonOk({ canvas });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonError(new Error("Invalid canvas update."));
    }
    return jsonError(error);
  }
}

export async function DELETE(_request: Request, context: Ctx) {
  try {
    const user = await requireUser();
    const { canvasId } = await context.params;
    await deleteChatCanvas(user.id, canvasId);
    return jsonOk({ deleted: true });
  } catch (error) {
    return jsonError(error);
  }
}
