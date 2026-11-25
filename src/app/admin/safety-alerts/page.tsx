import { AdminSafetyAlerts } from "@/components/admin/admin-safety-alerts";
import { getAdminSafetyAlerts } from "@/lib/admin";
import { loadAdminPage } from "@/lib/admin-page";

export const dynamic = "force-dynamic";

export default async function AdminSafetyAlertsPage() {
  await loadAdminPage("/admin/safety-alerts");
  return <AdminSafetyAlerts initial={await getAdminSafetyAlerts({})} />;
}
