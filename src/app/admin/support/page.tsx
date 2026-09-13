import { AdminSupport } from "@/components/admin/admin-support";
import { getHelpdeskInbox } from "@/lib/helpdesk";
import { loadAdminPage } from "@/lib/admin-page";

export const dynamic = "force-dynamic";

export default async function AdminSupportPage() {
  await loadAdminPage("/admin/support");
  return <AdminSupport initial={await getHelpdeskInbox()} />;
}
