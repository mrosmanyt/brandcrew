import { AdminInsights } from "@/components/admin/admin-insights";
import { getAdminInsights } from "@/lib/analytics";
import { loadAdminPage } from "@/lib/admin-page";

export const dynamic = "force-dynamic";

export default async function AdminInsightsPage() {
  await loadAdminPage("/admin/insights");
  return <AdminInsights initial={await getAdminInsights()} />;
}
