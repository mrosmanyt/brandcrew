import { NextResponse } from "next/server";
import { z } from "zod";
import { requireWorkspaceCapability, requireWorkspaceMember } from "@/lib/auth";
import { recordApprovalAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";
import { applyArtifactApproval } from "@/lib/approvals";
import { completeJobIfApproved } from "@/lib/job-runtime";
import { learnFromArtifactDecision } from "@/lib/learning-memory";

const schema = z.object({
  status: z.enum(["draft", "approved", "scheduled", "done", "rejected"]),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ workspaceId: string; artifactId: string }> },
) {
  try {
    const { workspaceId, artifactId } = await context.params;
    const parsed = schema.parse(await request.json());
    const deciding = parsed.status === "approved" || parsed.status === "rejected";
    const { user, role } = deciding
      ? await requireWorkspaceCapability(workspaceId, "approve_artifacts")
      : { ...(await requireWorkspaceMember(workspaceId)), role: "member" as const };
    const artifact = await prisma.artifact.update({
      where: { id: artifactId },
      data: { status: parsed.status },
    });

    let followup = { taskCreated: false, calendarAdded: 0 };
    if (parsed.status === "approved") {
      followup = await applyArtifactApproval({ workspaceId, artifact });
      await learnFromArtifactDecision({
        workspaceId,
        status: "approved",
        artifact,
      });
      await recordApprovalAudit({
        workspaceId,
        jobId: artifact.jobId,
        actorEmail: user.email,
        actorRole: role,
        action: "artifact_approved",
        detail: `${user.email} (${role}) approved “${artifact.title}”.`,
        data: { artifactId: artifact.id, title: artifact.title },
      });
      if (artifact.jobId) {
        await completeJobIfApproved(artifact.jobId, { email: user.email, role });
      }
    }
    if (parsed.status === "rejected") {
      await learnFromArtifactDecision({
        workspaceId,
        status: "rejected",
        artifact,
      });
      await recordApprovalAudit({
        workspaceId,
        jobId: artifact.jobId,
        actorEmail: user.email,
        actorRole: role,
        action: "artifact_rejected",
        detail: `${user.email} (${role}) rejected “${artifact.title}”.`,
        data: { artifactId: artifact.id, title: artifact.title },
      });
    }

    return jsonOk({ artifact, ...followup });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid artifact status." }, { status: 400 });
    }
    return jsonError(error);
  }
}
