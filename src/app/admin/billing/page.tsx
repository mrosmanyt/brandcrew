import {
  BarRow,
  EmptyRow,
  PanelCard,
  PanelHeader,
  formatDateTime,
} from "@/components/admin/panel/panel-ui";
import { getPanelBilling } from "@/lib/admin-panel";
import { loadAdminPage } from "@/lib/admin-page";

export const dynamic = "force-dynamic";

export default async function AdminBillingPage() {
  await loadAdminPage("/admin/billing");
  const data = await getPanelBilling();
  const totalWorkspaces = data.plans.reduce((sum, row) => sum + row.workspaces, 0);

  return (
    <>
      <PanelHeader
        title="Plans & billing"
        hint="Whop is the source of truth for who pays what. This page reports live counts — it never edits a plan or a price."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {data.plans.map((plan) => (
          <article key={plan.id} className="rounded-2xl border border-border bg-card p-4">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {plan.name}
              {plan.price > 0 ? ` · $${plan.price}/mo` : " · Free"}
            </p>
            <p className="mt-2 text-2xl font-semibold tracking-tight">
              {plan.workspaces.toLocaleString()}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              workspaces{plan.suspended > 0 ? ` · ${plan.suspended} suspended` : ""} ·{" "}
              {plan.tokenBudget.toLocaleString()} credits · {plan.seats} seat
              {plan.seats === 1 ? "" : "s"}
            </p>
          </article>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <PanelCard title="Plan mix" hint={`${data.paidWorkspaces.toLocaleString()} paid of ${totalWorkspaces.toLocaleString()} workspaces`}>
          {totalWorkspaces === 0 ? (
            <EmptyRow text="No workspaces yet." />
          ) : (
            <ul className="divide-y divide-border">
              {data.plans.map((plan) => (
                <BarRow
                  key={plan.id}
                  label={plan.name}
                  sub={plan.price > 0 ? `$${plan.price}/mo` : "Free"}
                  value={plan.workspaces.toLocaleString()}
                  share={totalWorkspaces > 0 ? plan.workspaces / totalWorkspaces : 0}
                />
              ))}
            </ul>
          )}
          <div className="border-t border-border px-5 py-4">
            <p className="text-sm font-medium">Founding members</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {data.founding.claimed} of {data.founding.total} spots claimed ·{" "}
              {data.founding.remaining} remaining ·{" "}
              {data.founding.open ? "still open for new signups" : "closed — full"}
            </p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-emerald-500"
                style={{
                  width: `${data.founding.total > 0 ? Math.round((data.founding.claimed / data.founding.total) * 100) : 0}%`,
                }}
              />
            </div>
          </div>
        </PanelCard>

        <PanelCard title="Recent Whop webhooks" hint="ProcessedWebhook rows — proof billing events are landing">
          {data.webhooks.length === 0 ? (
            <EmptyRow text="No webhooks processed yet." />
          ) : (
            <ul className="divide-y divide-border">
              {data.webhooks.map((row) => (
                <li key={row.id} className="flex flex-wrap items-baseline justify-between gap-3 px-5 py-3 text-sm">
                  <span className="font-medium">{row.eventType}</span>
                  <span className="text-xs text-muted-foreground">{formatDateTime(row.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </PanelCard>
      </div>

      <PanelCard title="Support payments" hint="BrandSupport rows (tips / support checkouts via Whop)" className="mt-4">
        {data.supports.length === 0 ? (
          <EmptyRow text="No support payments recorded." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="px-5 py-2.5 font-medium">Email</th>
                  <th className="px-3 py-2.5 font-medium">Amount</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-5 py-2.5 font-medium">When</th>
                </tr>
              </thead>
              <tbody>
                {data.supports.map((row) => (
                  <tr key={row.id} className="border-b border-border last:border-0">
                    <td className="px-5 py-3">{row.email || "—"}</td>
                    <td className="px-3 py-3">
                      {(row.amountCents / 100).toLocaleString("en-US", {
                        style: "currency",
                        currency: row.currency.toUpperCase(),
                      })}
                    </td>
                    <td className="px-3 py-3">{row.status}</td>
                    <td className="px-5 py-3 text-muted-foreground">{formatDateTime(row.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PanelCard>
    </>
  );
}
