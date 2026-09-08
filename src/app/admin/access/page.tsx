import { AdminForbidden } from "@/components/admin/admin-forbidden";
import { AdminAccess } from "@/components/admin/admin-access";
import { getAdminAccess } from "@/lib/admin";
import { loadAdminPage } from "@/lib/admin-page";

export const dynamic = "force-dynamic";

export default async function AdminAccessPage() {
  const { allowed } = await loadAdminPage("/admin/access");
  if (!allowed) return <AdminForbidden />;
  return <AdminAccess data={getAdminAccess()} />;
}
