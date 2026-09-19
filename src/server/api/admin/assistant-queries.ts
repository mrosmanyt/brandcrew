import { z } from "zod";
import {
  approveAssistantRegistration,
  assistantRegistrationAdminConfigured,
  listAssistantRegistrations,
  rejectAssistantRegistration,
} from "@/lib/assistant-registration-admin";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { ClientError, jsonError, jsonOk } from "@/lib/http";

const postSchema = z.object({
  action: z.enum(["approve", "reject"]),
  requestId: z.string().uuid(),
});

function notConfiguredError() {
  return new ClientError(
    "Supabase admin is not configured. Set SUPABASE_SERVICE_ROLE_KEY on the server.",
    503,
    "service_unconfigured",
  );
}

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const status =
      (new URL(request.url).searchParams.get("status") as
        | "pending"
        | "approved"
        | "rejected"
        | "all"
        | null) || "all";
    const payload = await listAssistantRegistrations({ status });
    const configured = payload.configured && assistantRegistrationAdminConfigured();
    return jsonOk({
      configured,
      rows: payload.rows,
      ...(configured
        ? {}
        : {
            notice:
              "Supabase service role is missing — queries cannot be loaded or updated until SUPABASE_SERVICE_ROLE_KEY is set.",
          }),
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    if (!assistantRegistrationAdminConfigured()) {
      throw notConfiguredError();
    }
    const body = postSchema.parse(await request.json().catch(() => ({})));

    const row =
      body.action === "approve"
        ? await approveAssistantRegistration(body.requestId)
        : await rejectAssistantRegistration(body.requestId);

    try {
      await prisma.adminAuditLog.create({
        data: {
          actorEmail: admin.email,
          action: body.action === "approve" ? "assistant_query_approve" : "assistant_query_reject",
          targetId: body.requestId,
          meta: JSON.stringify({
            email: row.email,
            name: row.name,
            status: row.status,
          }),
        },
      });
    } catch (auditError) {
      console.error("[admin] assistant-query audit log failed", auditError);
    }

    return jsonOk({ row, configured: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonError(new ClientError("Invalid assistant query action."));
    }
    return jsonError(error);
  }
}
