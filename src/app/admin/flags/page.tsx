import { AdminForbidden } from "@/components/admin/admin-forbidden";
import { AdminFlags } from "@/components/admin/admin-flags";
import { getAdminFlags } from "@/lib/admin";
import { loadAdminPage } from "@/lib/admin-page";

export const dynamic = "force-dynamic";

export default async function AdminFlagsPage() {
  const { allowed } = await loadAdminPage("/admin/flags");
  if (!allowed) return <AdminForbidden />;
  return <AdminFlags initial={await getAdminFlags()} />;
}
