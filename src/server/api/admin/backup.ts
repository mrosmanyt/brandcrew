import { NextResponse } from "next/server";
import { backupFilename, buildAdminBackup } from "@/lib/admin-backup";
import { requireAdmin } from "@/lib/admin";
import { jsonError } from "@/lib/http";

export async function GET(request: Request) {
  try {
    const admin = await requireAdmin();
    const url = new URL(request.url);
    const full = url.searchParams.get("full") === "1";
    const backup = await buildAdminBackup({
      actorEmail: admin.email,
      full,
    });
    const body = JSON.stringify(backup, null, 2);
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${backupFilename()}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
