import { redirect } from "next/navigation";

/** Customers moved to /admin/users in the Admin Panel v1. */
export default async function AdminCustomersRedirect({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; userId?: string }>;
}) {
  const query = await searchParams;
  if (query.userId) redirect(`/admin/users/${query.userId}`);
  if (query.q) redirect(`/admin/users?q=${encodeURIComponent(query.q)}`);
  redirect("/admin/users");
}
