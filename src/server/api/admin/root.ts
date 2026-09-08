import { NextResponse } from "next/server";
import { z } from "zod";
import {
  adminAssignPlan,
  adminRevokePlan,
  getAdminDashboard,
  requireAdmin,
} from "@/lib/admin";
import { jsonError, jsonOk } from "@/lib/http";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const url = new URL(request.url);
    const q = url.searchParams.get("q");
    const dashboard = await getAdminDashboard(q);
    return jsonOk(dashboard);
  } catch (error) {
    return jsonError(error);
  }
}

const mutateSchema = z.object({
  action: z.enum(["assign", "revoke"]),
  plan: z.enum(["demo", "starter", "pro", "ultra", "growth"]).optional(),
  workspaceId: z.string().min(1).optional(),
  userEmail: z.string().email().optional(),
});

export async function POST(request: Request) {
  try {
    const actor = await requireAdmin();
    const body = mutateSchema.parse(await request.json());
    if (body.action === "revoke") {
      const result = await adminRevokePlan({
        actorEmail: actor.email,
        workspaceId: body.workspaceId,
        userEmail: body.userEmail,
      });
      const dashboard = await getAdminDashboard();
      return jsonOk({ ...dashboard, updated: result.workspaces });
    }
    if (!body.plan) {
      return NextResponse.json(
        { error: "Choose a plan.", code: "invalid_request" },
        { status: 400 },
      );
    }
    const result = await adminAssignPlan({
      actorEmail: actor.email,
      plan: body.plan,
      workspaceId: body.workspaceId,
      userEmail: body.userEmail,
    });
    const dashboard = await getAdminDashboard();
    return jsonOk({ ...dashboard, updated: result.workspaces });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid admin request.", code: "invalid_request" },
        { status: 400 },
      );
    }
    return jsonError(error);
  }
}
