import { AdminAccess } from "@/components/admin/admin-access";
import { getAdminAccess } from "@/lib/admin";
import { loadAdminPage } from "@/lib/admin-page";

export const dynamic = "force-dynamic";

export default async function AdminAccessPage() {
  await loadAdminPage("/admin/access");
  return <AdminAccess data={getAdminAccess()} />;
}
