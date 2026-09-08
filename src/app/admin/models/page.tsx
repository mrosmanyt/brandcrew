import { AdminForbidden } from "@/components/admin/admin-forbidden";
import { AdminModels } from "@/components/admin/admin-models";
import { getAdminModels } from "@/lib/admin";
import { loadAdminPage } from "@/lib/admin-page";

export const dynamic = "force-dynamic";

export default async function AdminModelsPage() {
  const { allowed } = await loadAdminPage("/admin/models");
  if (!allowed) return <AdminForbidden />;
  return <AdminModels data={await getAdminModels()} />;
}
