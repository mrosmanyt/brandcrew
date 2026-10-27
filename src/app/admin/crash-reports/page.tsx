import { AdminCrashReports } from "@/components/admin/admin-crash-reports";
import { getAdminCrashReports } from "@/lib/admin";
import { loadAdminPage } from "@/lib/admin-page";

export const dynamic = "force-dynamic";

export default async function AdminCrashReportsPage() {
  await loadAdminPage("/admin/crash-reports");
  return <AdminCrashReports initial={await getAdminCrashReports()} />;
}
