import Link from "next/link";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { PanelHeader, formatDate, formatDateTime } from "@/components/admin/panel/panel-ui";
import { getPanelUsers } from "@/lib/admin-panel";
import { loadAdminPage } from "@/lib/admin-page";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  await loadAdminPage("/admin/users");
  const query = await searchParams;
  const data = await getPanelUsers({
    q: query.q,
    page: Number(query.page) || 1,
  });

  const pageHref = (page: number) =>
    `/admin/users?page=${page}${data.q ? `&q=${encodeURIComponent(data.q)}` : ""}`;

  return (
    <>
      <PanelHeader
        title="Users"
        hint={`${data.total.toLocaleString()} account${data.total === 1 ? "" : "s"} — plan and credits come from each user's primary workspace.`}
      />

      <form method="get" className="mb-4 flex max-w-md items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            name="q"
            defaultValue={data.q}
            placeholder="Search by name or email…"
            className="w-full rounded-xl border border-border bg-card py-2 pr-3 pl-9 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
          />
        </div>
        <button
          type="submit"
          className="rounded-xl bg-zinc-950 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-zinc-950"
        >
          Search
        </button>
      </form>

      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        {data.rows.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">
            {data.q ? `No users match “${data.q}”.` : "No users yet."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem] text-left text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="px-5 py-3 font-medium">User</th>
                  <th className="px-3 py-3 font-medium">Plan</th>
                  <th className="px-3 py-3 font-medium">Credits left</th>
                  <th className="px-3 py-3 font-medium">Joined</th>
                  <th className="px-5 py-3 font-medium">Last chat activity</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                    <td className="px-5 py-3">
                      <Link href={`/admin/users/${row.id}`} className="font-medium hover:underline">
                        {row.name}
                      </Link>
                      <span className="block text-xs text-muted-foreground">
                        {row.email}
                        {row.foundingNumber ? ` · Founding #${row.foundingNumber}` : ""}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      {row.planName}
                      {row.suspended ? (
                        <span className="ml-1.5 rounded-full bg-red-500/10 px-2 py-0.5 text-[11px] font-medium text-red-600 dark:text-red-400">
                          Suspended
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      {row.creditsLeft.toLocaleString()}
                      <span className="text-muted-foreground"> / {row.creditsBudget.toLocaleString()}</span>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-muted-foreground">
                      {formatDate(row.joinedAt)}
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap text-muted-foreground">
                      {row.lastChatActivity ? formatDateTime(row.lastChatActivity) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex items-center justify-between border-t border-border px-5 py-3 text-sm text-muted-foreground">
          <span>
            Page {data.page} of {data.totalPages}
          </span>
          <span className="flex gap-1">
            {data.page > 1 ? (
              <Link href={pageHref(data.page - 1)} className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 hover:bg-muted hover:text-foreground">
                <ChevronLeft className="size-4" /> Prev
              </Link>
            ) : null}
            {data.page < data.totalPages ? (
              <Link href={pageHref(data.page + 1)} className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 hover:bg-muted hover:text-foreground">
                Next <ChevronRight className="size-4" />
              </Link>
            ) : null}
          </span>
        </div>
      </section>
    </>
  );
}
