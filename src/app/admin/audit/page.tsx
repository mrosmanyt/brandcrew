import { AdminAudit } from "@/components/admin/admin-audit";
import { getAdminAudit } from "@/lib/admin";
import { loadAdminPage } from "@/lib/admin-page";

export const dynamic = "force-dynamic";

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; actor?: string; q?: string }>;
}) {
  await loadAdminPage("/admin/audit");
  const query = await searchParams;
  const initial = await getAdminAudit({
    action: query.action,
    actor: query.actor,
    q: query.q,
  });
  return <AdminAudit initial={initial} />;
}
