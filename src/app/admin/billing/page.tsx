import { AdminBilling } from "@/components/admin/admin-billing";
import { getAdminBilling } from "@/lib/admin";
import { loadAdminPage } from "@/lib/admin-page";

export const dynamic = "force-dynamic";

export default async function AdminBillingPage() {
  await loadAdminPage("/admin/billing");
  return <AdminBilling initial={await getAdminBilling()} />;
}
