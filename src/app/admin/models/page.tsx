import { AdminModels } from "@/components/admin/admin-models";
import { getAdminModels } from "@/lib/admin";
import { loadAdminPage } from "@/lib/admin-page";

export const dynamic = "force-dynamic";

export default async function AdminModelsPage() {
  await loadAdminPage("/admin/models");
  return <AdminModels data={await getAdminModels()} />;
}
