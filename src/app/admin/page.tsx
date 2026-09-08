import { AdminForbidden } from "@/components/admin/admin-forbidden";
import { AdminOverview } from "@/components/admin/admin-overview";
import { getAdminDashboard } from "@/lib/admin";
import { loadAdminPage } from "@/lib/admin-page";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const { allowed } = await loadAdminPage("/admin");
  if (!allowed) return <AdminForbidden />;
  const dashboard = await getAdminDashboard();
  return <AdminOverview initial={dashboard} />;
}
