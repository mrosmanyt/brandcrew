import { requireWorkspaceCapability } from "@/lib/auth";
import { packWorkspaceAuditExport } from "@/lib/audit-export";
import { recordWorkspaceAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";

export async function GET(
  _request: Request,
  context: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const { workspaceId } = await context.params;
    const { user, role } = await requireWorkspaceCapability(workspaceId, "audit_export");
    const rows = await prisma.workspaceAudit.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "asc" },
      take: 500,
    });
    const pack = packWorkspaceAuditExport({
      workspaceId,
      exportedBy: user.email,
      exportedByRole: role,
      rows,
    });
    await recordWorkspaceAudit({
      workspaceId,
      actor: user.email,
      action: "audit_export",
      detail: `${user.email} (${role}) exported ${pack.count} audit rows.`,
      data: {
        actorEmail: user.email,
        actorRole: role,
        count: pack.count,
        packHash: pack.packHash,
        certified: false,
      },
    });
    return jsonOk(pack);
  } catch (error) {
    return jsonError(error);
  }
}
