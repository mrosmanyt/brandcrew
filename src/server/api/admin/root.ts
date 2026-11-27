import { NextResponse } from "next/server";
import { z } from "zod";
import {
  adminApprovePurchaseRequest,
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
  getAdminFunnel,
  getAdminModels,
  getAdminSafetyAlerts,
  adminSetSafetyAlertStatus,
  getAdminStudioPacks,
  adminSaveStudioPack,
  adminDeleteStudioPack,
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
    if (section === "safetyalerts") {
      return jsonOk(
        await getAdminSafetyAlerts({
          status: url.searchParams.get("status"),
          category: url.searchParams.get("category"),
        }),
      );
    }
    if (section === "studiopacks") {
      return jsonOk(await getAdminStudioPacks(admin.email));
    }
    if (section === "funnel") {
      return jsonOk(await getAdminFunnel());
    }
    return jsonOk(await getAdminDashboard(q));
  } catch (error) {
    return jsonError(error);
  }
}

const studioPresetSchema = z.object({
  id: z.string().min(1).max(64),
  label: z.string().min(1).max(80),
  blurb: z.string().max(240),
  modes: z.array(z.enum(["edit", "generate"])).min(1).max(2),
  editPrompt: z.string().max(4000),
  generateSuffix: z.string().max(2000),
  seasonal: z.boolean().optional(),
});

const studioPackSchema = z.object({
  slug: z.string().min(1).max(64),
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  startsAt: z.string().max(40).nullable().optional(),
  endsAt: z.string().max(40).nullable().optional(),
  active: z.boolean(),
  sortOrder: z.number().int().min(0).max(999).optional(),
  presets: z.array(studioPresetSchema).min(1).max(24),
});

const mutateSchema = z.object({
  action: z.enum([
    "assign",
    "revoke",
    "suspend",
    "unsuspend",
    "flag",
    "budget",
    "purchase_request",
    "safety_alert_status",
    "studio_pack_save",
    "studio_pack_delete",
  ]),
  plan: z.enum(["demo", "starter", "pro", "ultra", "growth"]).optional(),
  workspaceId: z.string().min(1).optional(),
  userEmail: z.string().email().optional(),
  flagKey: z.string().min(1).max(80).optional(),
  enabled: z.boolean().optional(),
  note: z.string().max(240).optional(),
  tokenBudget: z.number().int().min(1).max(5_000_000).optional(),
  purchaseRequestId: z.string().min(1).optional(),
  approved: z.boolean().optional(),
  alertId: z.string().min(1).optional(),
  alertStatus: z.enum(["NEW", "REVIEWED", "DISMISSED"]).optional(),
  packId: z.string().min(1).optional(),
  pack: studioPackSchema.optional(),
});

export async function POST(request: Request) {
  try {
    const actor = await requireAdmin();
    const body = mutateSchema.parse(await request.json());
    const actorEmail = actor.email;

    if (body.action === "safety_alert_status") {
      if (!body.alertId || !body.alertStatus) {
        return NextResponse.json(
          { error: "alertId and alertStatus are required.", code: "invalid_request" },
          { status: 400 },
        );
      }
      const status = await adminSetSafetyAlertStatus({
        actorEmail,
        id: body.alertId,
        status: body.alertStatus,
      });
      return jsonOk({ ok: true, action: "safety_alert_status" as const, status });
    }

    if (body.action === "studio_pack_save") {
      if (!body.pack) {
        return NextResponse.json(
          { error: "Pack details are required.", code: "invalid_request" },
          { status: 400 },
        );
      }
      const pack = await adminSaveStudioPack({
        actorEmail,
        id: body.packId ?? null,
        slug: body.pack.slug,
        name: body.pack.name,
        description: body.pack.description,
        startsAt: body.pack.startsAt,
        endsAt: body.pack.endsAt,
        active: body.pack.active,
        sortOrder: body.pack.sortOrder,
        presets: body.pack.presets,
      });
      return jsonOk({ ok: true, action: "studio_pack_save" as const, pack });
    }

    if (body.action === "studio_pack_delete") {
      if (!body.packId) {
        return NextResponse.json(
          { error: "packId is required.", code: "invalid_request" },
          { status: 400 },
        );
      }
      const deleted = await adminDeleteStudioPack({
        actorEmail,
        id: body.packId,
      });
      return jsonOk({ ok: true, action: "studio_pack_delete" as const, deleted });
    }

    if (body.action === "purchase_request") {
      if (!body.purchaseRequestId || typeof body.approved !== "boolean") {
        return NextResponse.json(
          { error: "purchaseRequestId and approved are required.", code: "invalid_request" },
          { status: 400 },
        );
      }
      const row = await adminApprovePurchaseRequest({
        actorEmail,
        id: body.purchaseRequestId,
        approved: body.approved,
      });
      return jsonOk({ ok: true, action: "purchase_request" as const, request: row });
    }

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
