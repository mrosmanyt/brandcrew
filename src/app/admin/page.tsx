import { AdminOverview } from "@/components/admin/admin-overview";
import { getAdminDashboard } from "@/lib/admin";
import { loadAdminPage } from "@/lib/admin-page";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await loadAdminPage("/admin");
  const dashboard = await getAdminDashboard();
  return <AdminOverview initial={dashboard} />;
}
