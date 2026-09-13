import { AdminCustomers } from "@/components/admin/admin-customers";
import { getAdminCustomers } from "@/lib/admin";
import { loadAdminPage } from "@/lib/admin-page";

export const dynamic = "force-dynamic";

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; userId?: string }>;
}) {
  await loadAdminPage("/admin/customers");
  const query = await searchParams;
  const q = query.q?.trim() || "";
  const userId = query.userId?.trim() || "";
  const initial = await getAdminCustomers({ q, userId });
  return <AdminCustomers initial={initial} initialQuery={q} initialUserId={userId} />;
}
