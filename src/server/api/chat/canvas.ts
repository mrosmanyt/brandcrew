import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createChatCanvas, listChatCanvases } from "@/lib/chat-canvas";
import {
  CANVAS_CONTENT_MAX_CHARS,
  CANVAS_TITLE_MAX,
} from "@/lib/chat-canvas-pure";
import { ClientError, jsonError, jsonOk } from "@/lib/http";

const createSchema = z.object({
  conversationId: z.string().trim().min(1).max(64),
  title: z.string().trim().max(CANVAS_TITLE_MAX).optional(),
  kind: z.enum(["document", "code"]).optional(),
  language: z.string().trim().max(40).optional(),
  content: z.string().max(CANVAS_CONTENT_MAX_CHARS).optional(),
});

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const conversationId = new URL(request.url).searchParams.get("conversationId");
    if (!conversationId) {
      throw new ClientError("A conversation is required.", 400, "invalid_request");
    }
    return jsonOk({
      canvases: await listChatCanvases(user.id, conversationId),
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = createSchema.parse(await request.json());
    const canvas = await createChatCanvas({
      userId: user.id,
      conversationId: body.conversationId,
      title: body.title,
      kind: body.kind,
      language: body.language,
      content: body.content,
    });
    return jsonOk({ canvas }, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonError(new Error("Invalid canvas payload."));
    }
    return jsonError(error);
  }
}
