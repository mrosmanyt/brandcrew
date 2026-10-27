import { AdminTrust } from "@/components/admin/admin-trust";
import { getAdminTrust } from "@/lib/admin";
import { loadAdminPage } from "@/lib/admin-page";

export const dynamic = "force-dynamic";

export default async function AdminTrustPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await loadAdminPage("/admin/trust");
  const query = await searchParams;
  const q = query.q?.trim() || "";
  const initial = await getAdminTrust({ q });
  return <AdminTrust initial={initial} initialQuery={q} />;
}
