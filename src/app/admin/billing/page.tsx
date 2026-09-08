import { AdminForbidden } from "@/components/admin/admin-forbidden";
import { AdminBilling } from "@/components/admin/admin-billing";
import { getAdminBilling } from "@/lib/admin";
import { loadAdminPage } from "@/lib/admin-page";

export const dynamic = "force-dynamic";

export default async function AdminBillingPage() {
  const { allowed } = await loadAdminPage("/admin/billing");
  if (!allowed) return <AdminForbidden />;
  return <AdminBilling initial={await getAdminBilling()} />;
}
