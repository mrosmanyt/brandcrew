import { requireWorkspaceMember } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";
import { parsePackedReplay } from "@/lib/session-replay";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  context: { params: Promise<{ workspaceId: string; jobId: string }> },
) {
  try {
    const { workspaceId, jobId } = await context.params;
    await requireWorkspaceMember(workspaceId);
    const replay = await prisma.sessionReplay.findFirst({
      where: { workspaceId, jobId },
    });
    if (!replay) {
      return NextResponse.json({ error: "No replay packed for this job yet." }, { status: 404 });
    }
    return jsonOk({
      replay: parsePackedReplay(replay.packed),
      stepCount: replay.stepCount,
      llmCalls: replay.llmCalls,
      llmSkipped: replay.llmSkipped,
      cacheHits: replay.cacheHits,
      createdAt: replay.createdAt.toISOString(),
    });
  } catch (error) {
    return jsonError(error);
  }
}
