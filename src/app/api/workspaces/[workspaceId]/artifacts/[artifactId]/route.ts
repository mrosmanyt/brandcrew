import { NextResponse } from "next/server";
import { z } from "zod";
import { requireWorkspaceMember } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";
import { applyArtifactApproval } from "@/lib/approvals";

const schema = z.object({
  status: z.enum(["draft", "approved", "scheduled", "done"]),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ workspaceId: string; artifactId: string }> },
) {
  try {
    const { workspaceId, artifactId } = await context.params;
    await requireWorkspaceMember(workspaceId);
    const body = schema.parse(await request.json());
    const artifact = await prisma.artifact.update({
      where: { id: artifactId },
      data: { status: body.status },
    });

    let followup = { taskCreated: false, calendarAdded: 0 };
    if (body.status === "approved") {
      followup = await applyArtifactApproval({ workspaceId, artifact });
    }

    return jsonOk({ artifact, ...followup });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid artifact status." }, { status: 400 });
    }
    return jsonError(error);
  }
}
