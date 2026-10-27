import { requireWorkspaceMember } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { runRoutineNow } from "@/lib/routines";
import { BudgetError } from "@/lib/usage";
import { NextResponse } from "next/server";

export async function POST(
  _request: Request,
  context: { params: Promise<{ workspaceId: string; routineId: string }> },
) {
  try {
    const { workspaceId, routineId } = await context.params;
    await requireWorkspaceMember(workspaceId);
    const { jobId } = await runRoutineNow({ workspaceId, routineId });
    return jsonOk({ jobId });
  } catch (error) {
    if (error instanceof BudgetError) {
      return NextResponse.json({ error: error.message }, { status: 402 });
    }
    return jsonError(error);
  }
}
