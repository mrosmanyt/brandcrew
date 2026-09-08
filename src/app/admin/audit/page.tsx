import { AdminForbidden } from "@/components/admin/admin-forbidden";
import { AdminAudit } from "@/components/admin/admin-audit";
import { getAdminAudit } from "@/lib/admin";
import { loadAdminPage } from "@/lib/admin-page";

export const dynamic = "force-dynamic";

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; actor?: string; q?: string }>;
}) {
  const { allowed } = await loadAdminPage("/admin/audit");
  if (!allowed) return <AdminForbidden />;
  const query = await searchParams;
  const initial = await getAdminAudit({
    action: query.action,
    actor: query.actor,
    q: query.q,
  });
  return <AdminAudit initial={initial} />;
}
