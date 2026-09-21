import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { honeypotFilled } from "@/lib/form-guard";
import {
  createHelpdeskThread,
  getFounderAvailability,
  listViewerThreads,
  viewerFromUser,
} from "@/lib/helpdesk";
import { jsonError, jsonOk, recordJsonErrorCode } from "@/lib/http";

function guestKeyFrom(request: Request) {
  return request.headers.get("x-cinem-help-key")?.trim() || "";
}

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    const guestKey = guestKeyFrom(request);
    const [threads, presence] = await Promise.all([
      listViewerThreads({ user, guestKey }),
      getFounderAvailability(),
    ]);
    return jsonOk({
      viewer: viewerFromUser(user),
      founderAvailable: presence.available,
      threads,
    });
  } catch (error) {
    recordJsonErrorCode(error);
    return jsonError(error);
  }
}

const createSchema = z.object({
  message: z.string().trim().min(1).max(4000),
  email: z.string().trim().email().max(180).optional(),
  name: z.string().trim().max(80).optional(),
  pageUrl: z.string().trim().max(500).optional(),
  workspaceId: z.string().trim().max(80).optional(),
  liveRequested: z.boolean().optional(),
});

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    const body = await request.json();
    if (honeypotFilled(body)) {
      return jsonOk({ ok: true, ignored: true });
    }
    const parsed = createSchema.parse(body);
    const thread = await createHelpdeskThread({
      user,
      email: parsed.email,
      name: parsed.name,
      message: parsed.message,
      pageUrl: parsed.pageUrl,
      workspaceId: parsed.workspaceId,
      liveRequested: parsed.liveRequested,
    });
    return jsonOk({ thread, viewer: viewerFromUser(user) }, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Write a short message so we can help.", code: "invalid_request" },
        { status: 400 },
      );
    }
    recordJsonErrorCode(error);
    return jsonError(error);
  }
}
