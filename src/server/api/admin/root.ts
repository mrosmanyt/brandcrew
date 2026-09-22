import { NextResponse } from "next/server";
import { z } from "zod";
import {
  adminAssignPlan,
  adminRevokePlan,
  adminSetBudget,
  adminSetFeatureFlag,
  adminSuspendWorkspace,
  adminUnsuspendWorkspace,
  getAdminAccess,
  getAdminAudit,
  getAdminBilling,
  getAdminCrashReports,
  getAdminCustomers,
  getAdminDashboard,
  getAdminFlags,
  getAdminModels,
  getAdminTrust,
  exportAdminAudit,
  parseAdminSection,
  requireAdmin,
} from "@/lib/admin";
import { jsonError, jsonOk } from "@/lib/http";

export async function GET(request: Request) {
  try {
    const admin = await requireAdmin();
    const url = new URL(request.url);
    const section = parseAdminSection(url.searchParams.get("section"));
    const q = url.searchParams.get("q");
    if (section === "customers") {
      return jsonOk(
        await getAdminCustomers({
          q,
          userId: url.searchParams.get("userId"),
        }),
      );
    }
    if (section === "billing") {
      return jsonOk(await getAdminBilling());
    }
    if (section === "models") {
      return jsonOk(await getAdminModels());
    }
    if (section === "access") {
      return jsonOk(getAdminAccess());
    }
    if (section === "audit") {
      if (url.searchParams.get("export") === "1") {
        return jsonOk(
          await exportAdminAudit({
            actorEmail: admin.email,
            action: url.searchParams.get("action"),
            actor: url.searchParams.get("actor"),
            q,
          }),
        );
      }
      return jsonOk(
        await getAdminAudit({
          action: url.searchParams.get("action"),
          actor: url.searchParams.get("actor"),
          q,
        }),
      );
    }
    if (section === "trust") {
      return jsonOk(await getAdminTrust({ q }));
    }
    if (section === "flags") {
      return jsonOk(await getAdminFlags());
    }
    if (section === "crashreports") {
      return jsonOk(await getAdminCrashReports());
    }
    return jsonOk(await getAdminDashboard(q));
  } catch (error) {
    return jsonError(error);
  }
}

const mutateSchema = z.object({
  action: z.enum([
    "assign",
    "revoke",
    "suspend",
    "unsuspend",
    "flag",
    "budget",
  ]),
  plan: z.enum(["demo", "starter", "pro", "ultra", "growth"]).optional(),
  workspaceId: z.string().min(1).optional(),
  userEmail: z.string().email().optional(),
  flagKey: z.string().min(1).max(80).optional(),
  enabled: z.boolean().optional(),
  note: z.string().max(240).optional(),
  tokenBudget: z.number().int().min(1).max(5_000_000).optional(),
});

export async function POST(request: Request) {
  try {
    const actor = await requireAdmin();
    const body = mutateSchema.parse(await request.json());
    const actorEmail = actor.email;

    if (body.action === "flag") {
      if (!body.flagKey || typeof body.enabled !== "boolean") {
        return NextResponse.json(
          { error: "Flag key and enabled are required.", code: "invalid_request" },
          { status: 400 },
        );
      }
      const flag = await adminSetFeatureFlag({
        actorEmail,
        key: body.flagKey,
        enabled: body.enabled,
        note: body.note,
      });
      return jsonOk({ ok: true, action: "flag" as const, flag });
    }

    if (body.action === "budget") {
      if (typeof body.tokenBudget !== "number") {
        return NextResponse.json(
          { error: "Token budget is required.", code: "invalid_request" },
          { status: 400 },
        );
      }
      const result = await adminSetBudget({
        actorEmail,
        tokenBudget: body.tokenBudget,
        workspaceId: body.workspaceId,
        userEmail: body.userEmail,
      });
      return jsonOk({ ok: true, action: "budget" as const, updated: result.workspaces });
    }

    if (body.action === "revoke") {
      const result = await adminRevokePlan({
        actorEmail,
        workspaceId: body.workspaceId,
        userEmail: body.userEmail,
      });
      return jsonOk({ ok: true, action: "revoke" as const, updated: result.workspaces });
    }
    if (body.action === "suspend") {
      const result = await adminSuspendWorkspace({
        actorEmail,
        workspaceId: body.workspaceId,
        userEmail: body.userEmail,
      });
      return jsonOk({ ok: true, action: "suspend" as const, updated: result.workspaces });
    }
    if (body.action === "unsuspend") {
      const result = await adminUnsuspendWorkspace({
        actorEmail,
        workspaceId: body.workspaceId,
        userEmail: body.userEmail,
      });
      return jsonOk({ ok: true, action: "unsuspend" as const, updated: result.workspaces });
    }

    if (!body.plan) {
      return NextResponse.json(
        { error: "Choose a plan.", code: "invalid_request" },
        { status: 400 },
      );
    }
    const result = await adminAssignPlan({
      actorEmail,
      plan: body.plan,
      workspaceId: body.workspaceId,
      userEmail: body.userEmail,
    });
    return jsonOk({ ok: true, action: "assign" as const, updated: result.workspaces });
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
