import { AdminFlags } from "@/components/admin/admin-flags";
import { getAdminFlags } from "@/lib/admin";
import { loadAdminPage } from "@/lib/admin-page";

export const dynamic = "force-dynamic";

export default async function AdminFlagsPage() {
  await loadAdminPage("/admin/flags");
  return <AdminFlags initial={await getAdminFlags()} />;
}
