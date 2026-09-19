import { z } from "zod";
import {
  approveAssistantRegistration,
  assistantRegistrationAdminConfigured,
  listAssistantRegistrations,
  rejectAssistantRegistration,
} from "@/lib/assistant-registration-admin";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";

const postSchema = z.object({
  action: z.enum(["approve", "reject"]),
  requestId: z.string().uuid(),
});

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
    return jsonOk({
      configured: payload.configured && assistantRegistrationAdminConfigured(),
      rows: payload.rows,
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = postSchema.parse(await request.json());

    const row =
      body.action === "approve"
        ? await approveAssistantRegistration(body.requestId)
        : await rejectAssistantRegistration(body.requestId);

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

    return jsonOk({ row });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonError(new Error("Invalid assistant query action."));
    }
    return jsonError(error);
  }
}
