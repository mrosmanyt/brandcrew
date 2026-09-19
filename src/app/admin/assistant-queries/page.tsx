import { AdminAssistantQueries } from "@/components/admin/admin-assistant-queries";
import { assistantRegistrationAdminConfigured } from "@/lib/assistant-registration-admin";
import { loadAdminPage } from "@/lib/admin-page";

export const dynamic = "force-dynamic";

export default async function AdminAssistantQueriesPage() {
  await loadAdminPage("/admin/assistant-queries");
  return <AdminAssistantQueries configured={assistantRegistrationAdminConfigured()} />;
}
