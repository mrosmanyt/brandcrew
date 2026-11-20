import Link from "next/link";
import { Coins, CreditCard, Image as ImageIcon, MessageSquare, UserPlus, Users } from "lucide-react";
import { PanelChart } from "@/components/admin/panel/panel-chart";
import {
  BarRow,
  EmptyRow,
  PanelCard,
  PanelHeader,
  RangePills,
  StatCard,
  formatDate,
} from "@/components/admin/panel/panel-ui";
import { getPanelDashboard, parsePanelRange } from "@/lib/admin-panel";
import { loadAdminPage } from "@/lib/admin-page";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  await loadAdminPage("/admin");
  const days = parsePanelRange((await searchParams).days);
  const data = await getPanelDashboard(days);
  const planTotal = data.planMix.reduce((sum, row) => sum + row.workspaces, 0);

  const alerts: { label: string; detail: string; href: string }[] = [];
  if (data.alerts.foundingRemaining <= 10) {
    alerts.push({
      label: "Founding spots running low",
      detail: `${data.alerts.foundingRemaining} of ${data.alerts.foundingTotal} left (${data.alerts.foundingClaimed} claimed)`,
      href: "/admin/billing",
    });
  }
  if (data.alerts.openSupport > 0) {
    alerts.push({
      label: "Support inbox needs replies",
      detail: `${data.alerts.openSupport} open thread${data.alerts.openSupport === 1 ? "" : "s"}${data.alerts.liveSupport > 0 ? ` · ${data.alerts.liveSupport} live now` : ""}`,
      href: "/admin/support",
    });
  }
  if (data.alerts.suspendedWorkspaces > 0) {
    alerts.push({
      label: "Suspended workspaces",
      detail: `${data.alerts.suspendedWorkspaces} workspace${data.alerts.suspendedWorkspaces === 1 ? "" : "s"} currently suspended`,
      href: "/admin/users",
    });
  }

  return (
    <>
      <PanelHeader
        title="Dashboard"
        hint={`Live CINEM Pro numbers — last ${days} days where a range applies.`}
        actions={<RangePills basePath="/admin" active={days} />}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard icon={Users} label="Total users" value={data.cards.totalUsers.toLocaleString()} hint="All accounts ever created" />
        <StatCard icon={UserPlus} label="New signups" value={data.cards.newSignups.toLocaleString()} hint={`In the last ${days} days`} />
        <StatCard icon={CreditCard} label="Active paid plans" value={data.cards.activePaidPlans.toLocaleString()} hint="Workspaces on Pro · Pro Plus · Ultra" />
        <StatCard icon={MessageSquare} label="Chat messages" value={data.cards.messages.toLocaleString()} hint={`Sent in the last ${days} days`} />
        <StatCard icon={ImageIcon} label="Images generated" value={data.cards.images.toLocaleString()} hint={`In the last ${days} days`} />
        <StatCard icon={Coins} label="Chat credits used" value={data.cards.chatCredits.toLocaleString()} hint={`Tokens metered in the last ${days} days`} />
      </div>

      <PanelCard
        title="Activity"
        hint="New signups and chat messages per day"
        className="mt-4"
      >
        <PanelChart series={data.series} />
      </PanelCard>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <PanelCard title="Plan mix" hint="Workspaces on each plan">
          {planTotal === 0 ? (
            <EmptyRow text="No workspaces yet." />
          ) : (
            <ul className="divide-y divide-border">
              {data.planMix.map((row) => (
                <BarRow
                  key={row.id}
                  label={row.name}
                  sub={row.price > 0 ? `$${row.price}/mo` : "Free"}
                  value={row.workspaces.toLocaleString()}
                  share={planTotal > 0 ? row.workspaces / planTotal : 0}
                />
              ))}
            </ul>
          )}
        </PanelCard>

        <PanelCard title="Needs attention" hint="Computed from live tables — nothing invented">
          {alerts.length === 0 ? (
            <EmptyRow text="Nothing needs attention right now." />
          ) : (
            <ul className="divide-y divide-border">
              {alerts.map((alert) => (
                <li key={alert.label}>
                  <Link href={alert.href} className="block px-5 py-3 transition-colors hover:bg-muted/50">
                    <p className="text-sm font-medium">{alert.label}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{alert.detail}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <p className="border-t border-border px-5 py-3 text-xs text-muted-foreground">
            Whop webhooks processed in the last 7 days: {data.alerts.webhooksLast7d}
          </p>
        </PanelCard>

        <PanelCard
          title="Top pages"
          hint={`Marketing site visits, last ${days} days (FunnelEvent)`}
        >
          {data.topPages.length === 0 ? (
            <EmptyRow text="No site visits recorded in this range." />
          ) : (
            <ul className="divide-y divide-border">
              {data.topPages.map((row) => (
                <BarRow
                  key={row.path}
                  label={row.path}
                  value={`${row.visits.toLocaleString()} visits`}
                  share={row.share}
                />
              ))}
            </ul>
          )}
        </PanelCard>
      </div>

      <PanelCard title="Recent signups" hint="Newest accounts first" className="mt-4">
        {data.recentSignups.length === 0 ? (
          <EmptyRow text="No signups yet." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="px-5 py-2.5 font-medium">User</th>
                  <th className="px-3 py-2.5 font-medium">Plan</th>
                  <th className="px-5 py-2.5 font-medium">Joined</th>
                </tr>
              </thead>
              <tbody>
                {data.recentSignups.map((row) => (
                  <tr key={row.id} className="border-b border-border last:border-0">
                    <td className="px-5 py-3">
                      <Link href={`/admin/users/${row.id}`} className="font-medium hover:underline">
                        {row.name}
                      </Link>
                      <span className="block text-xs text-muted-foreground">{row.email}</span>
                    </td>
                    <td className="px-3 py-3">{row.planName}</td>
                    <td className="px-5 py-3 text-muted-foreground">{formatDate(row.createdAt)}</td>
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
