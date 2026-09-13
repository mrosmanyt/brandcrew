import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { honeypotFilled } from "@/lib/form-guard";
import { appendViewerMessage, getViewerThread, viewerFromUser } from "@/lib/helpdesk";
import { jsonError, jsonOk } from "@/lib/http";

function guestKeyFrom(request: Request) {
  return request.headers.get("x-cinem-help-key")?.trim() || "";
}

export async function GET(
  request: Request,
  context: { params: Promise<{ threadId: string }> },
) {
  try {
    const { threadId } = await context.params;
    const user = await getCurrentUser();
    const thread = await getViewerThread({
      threadId,
      user,
      guestKey: guestKeyFrom(request),
    });
    return jsonOk({ thread, viewer: viewerFromUser(user) });
  } catch (error) {
    return jsonError(error);
  }
}

const appendSchema = z.object({
  message: z.string().trim().max(4000).optional(),
  liveRequested: z.boolean().optional(),
  pageUrl: z.string().trim().max(500).optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ threadId: string }> },
) {
  try {
    const { threadId } = await context.params;
    const user = await getCurrentUser();
    const body = await request.json();
    if (honeypotFilled(body)) {
      return jsonOk({ ok: true, ignored: true });
    }
    const parsed = appendSchema.parse(body);
    if (!parsed.message && !parsed.liveRequested) {
      return NextResponse.json(
        { error: "Write a short message so we can help.", code: "invalid_request" },
        { status: 400 },
      );
    }
    const thread = await appendViewerMessage({
      threadId,
      user,
      guestKey: guestKeyFrom(request),
      message: parsed.message,
      liveRequested: parsed.liveRequested,
      pageUrl: parsed.pageUrl,
    });
    return jsonOk({ thread, viewer: viewerFromUser(user) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Write a short message so we can help.", code: "invalid_request" },
        { status: 400 },
      );
    }
    return jsonError(error);
  }
}
