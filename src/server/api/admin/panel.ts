import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin";
import { panelAdjustCredits, panelSetFoundingSlots } from "@/lib/admin-panel";
import { jsonError, jsonOk } from "@/lib/http";

/**
 * Admin Panel v1 mutations. Gated by requireAdmin() (ADMIN_EMAILS
 * allowlist; non-admins get a 404). Every action writes an
 * AdminAuditLog row inside the lib function.
 */
const mutateSchema = z.object({
  action: z.enum(["adjust_credits", "set_founding_slots"]),
  userId: z.string().min(1).optional(),
  newBudget: z.number().int().optional(),
  reason: z.string().max(240).optional(),
  total: z.number().int().optional(),
});

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = mutateSchema.parse(await request.json());

    if (body.action === "adjust_credits") {
      if (!body.userId || typeof body.newBudget !== "number") {
        return NextResponse.json(
          { error: "userId and newBudget are required.", code: "invalid_request" },
          { status: 400 },
        );
      }
      const result = await panelAdjustCredits({
        actorEmail: admin.email,
        userId: body.userId,
        newBudget: body.newBudget,
        reason: body.reason ?? "",
      });
      return jsonOk({ ok: true, action: body.action, ...result });
    }

    if (typeof body.total !== "number") {
      return NextResponse.json(
        { error: "total is required.", code: "invalid_request" },
        { status: 400 },
      );
    }
    const result = await panelSetFoundingSlots({
      actorEmail: admin.email,
      total: body.total,
    });
    return jsonOk({ ok: true, action: body.action, ...result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid panel request.", code: "invalid_request" },
        { status: 400 },
      );
    }
    return jsonError(error);
  }
}
