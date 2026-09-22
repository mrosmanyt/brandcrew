import { AdminFunnel } from "@/components/admin/admin-funnel";
import { getAdminFunnel } from "@/lib/admin";
import { loadAdminPage } from "@/lib/admin-page";

export const dynamic = "force-dynamic";

export default async function AdminFunnelPage() {
  await loadAdminPage("/admin/funnel");
  return <AdminFunnel initial={await getAdminFunnel()} />;
}
