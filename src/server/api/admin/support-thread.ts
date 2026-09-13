import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin";
import {
  founderJoinLive,
  founderLeaveLive,
  founderReplyToThread,
  founderSetThreadStatus,
  getAdminHelpdeskThread,
  parseHelpdeskStatus,
} from "@/lib/helpdesk";
import { jsonError, jsonOk } from "@/lib/http";

export async function GET(
  _request: Request,
  context: { params: Promise<{ threadId: string }> },
) {
  try {
    await requireAdmin();
    const { threadId } = await context.params;
    return jsonOk({ thread: await getAdminHelpdeskThread(threadId) });
  } catch (error) {
    return jsonError(error);
  }
}

const mutateSchema = z.object({
  action: z.enum(["reply", "join_live", "leave_live", "close", "reopen"]),
  body: z.string().trim().max(4000).optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ threadId: string }> },
) {
  try {
    const admin = await requireAdmin();
    const { threadId } = await context.params;
    const body = mutateSchema.parse(await request.json());
    if (body.action === "reply") {
      if (!body.body?.trim()) {
        return NextResponse.json(
          { error: "Write a reply first.", code: "invalid_request" },
          { status: 400 },
        );
      }
      return jsonOk({
        thread: await founderReplyToThread({
          threadId,
          actorEmail: admin.email,
          body: body.body,
        }),
      });
    }
    if (body.action === "join_live") {
      return jsonOk({
        thread: await founderJoinLive({ threadId, actorEmail: admin.email }),
      });
    }
    if (body.action === "leave_live") {
      return jsonOk({
        thread: await founderLeaveLive({ threadId, actorEmail: admin.email }),
      });
    }
    if (body.action === "close") {
      return jsonOk({
        thread: await founderSetThreadStatus({
          threadId,
          actorEmail: admin.email,
          status: "closed",
        }),
      });
    }
    return jsonOk({
      thread: await founderSetThreadStatus({
        threadId,
        actorEmail: admin.email,
        status: parseHelpdeskStatus("open"),
      }),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid admin support action.", code: "invalid_request" }, { status: 400 });
    }
    return jsonError(error);
  }
}
