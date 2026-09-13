import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin";
import { getHelpdeskInbox, touchFounderPresence } from "@/lib/helpdesk";
import { jsonError, jsonOk } from "@/lib/http";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const url = new URL(request.url);
    return jsonOk(
      await getHelpdeskInbox({
        status: url.searchParams.get("status"),
        q: url.searchParams.get("q"),
      }),
    );
  } catch (error) {
    return jsonError(error);
  }
}

const mutateSchema = z.object({
  action: z.enum(["presence"]),
});

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = mutateSchema.parse(await request.json());
    if (body.action === "presence") {
      return jsonOk(await touchFounderPresence(admin.email));
    }
    return NextResponse.json({ error: "Unknown action.", code: "invalid_request" }, { status: 400 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid admin support action.", code: "invalid_request" }, { status: 400 });
    }
    return jsonError(error);
  }
}
