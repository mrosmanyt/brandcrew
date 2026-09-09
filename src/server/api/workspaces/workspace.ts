import { NextResponse } from "next/server";
import { z } from "zod";
import { requireWorkspaceMember } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { parseBrandKit } from "@/lib/brand-kit";
import { getWorkspaceLimits, serializeLimits } from "@/lib/limits";
import { normalizeModelRouting } from "@/lib/llm-routing";
import { serializeWorkspace } from "@/lib/workspace";
import { getLlmStatus } from "@/lib/llm";
import { billingIsMock, billingProvider } from "@/lib/billing";
import { prisma } from "@/lib/db";
import { workspaceOnboarding } from "@/lib/onboarding";

const patchSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  onboardingDismissed: z.boolean().optional(),
  setupWizardDone: z.boolean().optional(),
  modelRouting: z.string().max(40).optional(),
});

export async function GET(
  _request: Request,
  context: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const { workspaceId } = await context.params;
    const { workspace, member } = await requireWorkspaceMember(workspaceId);
    const limits = serializeLimits(await getWorkspaceLimits(workspaceId));
    const [agentCount, jobCount, approvedCount] = await Promise.all([
      prisma.agent.count({ where: { workspaceId, status: { not: "archived" } } }),
      prisma.job.count({ where: { workspaceId } }),
      prisma.artifact.count({ where: { workspaceId, status: "approved" } }),
    ]);
    const onboarding = workspaceOnboarding({
      dismissed: member.onboardingDismissed,
      agentCount,
      jobCount,
      approvedCount,
    });
    return jsonOk({
      workspace: {
        ...serializeWorkspace(workspace),
        brandKit: parseBrandKit(workspace.brandKit),
        limits,
      },
      llm: getLlmStatus(),
      billingMock: billingIsMock(),
      billingProvider: billingProvider(),
      limits,
      onboarding,
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const { workspaceId } = await context.params;
    const { user } = await requireWorkspaceMember(workspaceId);
    const body = patchSchema.parse(await request.json());
    if (body.onboardingDismissed !== undefined || body.setupWizardDone !== undefined) {
      await prisma.workspaceMember.update({
        where: { workspaceId_userId: { workspaceId, userId: user.id } },
        data: {
          ...(body.onboardingDismissed !== undefined
            ? { onboardingDismissed: body.onboardingDismissed }
            : {}),
          ...(body.setupWizardDone !== undefined
            ? { setupWizardDone: body.setupWizardDone }
            : {}),
        },
      });
    }
    if (body.name?.trim() || body.modelRouting) {
      const workspace = await prisma.workspace.update({
        where: { id: workspaceId },
        data: {
          ...(body.name?.trim() ? { name: body.name.trim() } : {}),
          ...(body.modelRouting
            ? { modelRouting: normalizeModelRouting(body.modelRouting) }
            : {}),
        },
      });
      return jsonOk({ workspace: serializeWorkspace(workspace) });
    }
    const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
    return jsonOk({ workspace: serializeWorkspace(workspace) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
    }
    return jsonError(error);
  }
}
