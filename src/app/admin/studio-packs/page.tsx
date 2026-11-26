import { AdminStudioPacks } from "@/components/admin/admin-studio-packs";
import { getAdminStudioPacks } from "@/lib/admin";
import { loadAdminPage } from "@/lib/admin-page";

export const dynamic = "force-dynamic";

export default async function AdminStudioPacksPage() {
  const { user } = await loadAdminPage("/admin/studio-packs");
  return <AdminStudioPacks initial={await getAdminStudioPacks(user.email)} />;
}
