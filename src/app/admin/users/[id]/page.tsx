import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { CreditsForm } from "@/components/admin/panel/credits-form";
import {
  EmptyRow,
  PanelCard,
  PanelHeader,
  StatCard,
  formatDate,
  formatDateTime,
} from "@/components/admin/panel/panel-ui";
import { Coins, Image as ImageIcon, LifeBuoy, MessageSquare } from "lucide-react";
import { getPanelUserDetail } from "@/lib/admin-panel";
import { loadAdminPage } from "@/lib/admin-page";

export const dynamic = "force-dynamic";

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await loadAdminPage(`/admin/users/${id}`);
  const user = await getPanelUserDetail(id);
  if (!user) notFound();

  const primary =
    user.workspaces.find((ws) => ws.id === user.primaryWorkspaceId) ?? user.workspaces[0];

  return (
    <>
      <Link
        href="/admin/users"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> All users
      </Link>
      <PanelHeader
        title={user.name}
        hint={`${user.email} · joined ${formatDate(user.joinedAt)}${user.googleLinked ? " · Google linked" : ""}${user.foundingNumber ? ` · Founding member #${user.foundingNumber}` : ""}${user.supporter ? " · Supporter" : ""}`}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={MessageSquare} label="Chat messages" value={user.totals.messages.toLocaleString()} hint={`${user.totals.conversations.toLocaleString()} conversations`} />
        <StatCard icon={Coins} label="Chat credits used" value={user.totals.chatCredits.toLocaleString()} hint="Sum of metered message tokens" />
        <StatCard icon={ImageIcon} label="Images generated" value={user.totals.images.toLocaleString()} hint="All time" />
        <StatCard icon={LifeBuoy} label="Support threads" value={user.totals.supportThreads.toLocaleString()} hint={`${user.totals.openSupportThreads} open`} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <PanelCard title="Workspaces & plans" hint="Plans are set by Whop webhooks — this panel never flips a plan by hand.">
          {user.workspaces.length === 0 ? (
            <EmptyRow text="This user has no workspace." />
          ) : (
            <ul className="divide-y divide-border">
              {user.workspaces.map((ws) => (
                <li key={ws.id} className="px-5 py-3.5 text-sm">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-medium">
                      {ws.name}
                      {ws.id === user.primaryWorkspaceId ? (
                        <span className="ml-1.5 text-xs font-normal text-muted-foreground">(primary)</span>
                      ) : null}
                    </span>
                    <span>
                      {ws.planName}
                      {ws.suspended ? (
                        <span className="ml-1.5 rounded-full bg-red-500/10 px-2 py-0.5 text-[11px] font-medium text-red-600 dark:text-red-400">
                          Suspended
                        </span>
                      ) : null}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Role {ws.role} · Credits {ws.creditsLeft.toLocaleString()} left of{" "}
                    {ws.creditsBudget.toLocaleString()} ({ws.creditsUsed.toLocaleString()} used) ·
                    Chat-budget meter {ws.chatCreditsUsed.toLocaleString()}
                    {ws.whopMembershipId ? ` · Whop membership ${ws.whopMembershipId}` : " · No Whop membership"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </PanelCard>

        <PanelCard title="Adjust credits" hint="Primary workspace only — every change is written to the activity log.">
          {primary ? (
            <CreditsForm
              userId={user.id}
              currentBudget={primary.creditsBudget}
              creditsUsed={primary.creditsUsed}
            />
          ) : (
            <EmptyRow text="No workspace to adjust." />
          )}
        </PanelCard>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <PanelCard title="Recent conversations" hint="Titles only — message content stays private to the user.">
          {user.recentConversations.length === 0 ? (
            <EmptyRow text="No chat conversations yet." />
          ) : (
            <ul className="divide-y divide-border">
              {user.recentConversations.map((row) => (
                <li key={row.id} className="flex items-baseline justify-between gap-3 px-5 py-3 text-sm">
                  <span className="min-w-0 truncate font-medium">{row.title}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {row.messages} msgs · {formatDateTime(row.updatedAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </PanelCard>

        <PanelCard title="Recent images" hint="Prompts from the image pipeline and Photo Studio.">
          {user.recentImages.length === 0 ? (
            <EmptyRow text="No images generated yet." />
          ) : (
            <ul className="divide-y divide-border">
              {user.recentImages.map((row) => (
                <li key={row.id} className="px-5 py-3 text-sm">
                  <p className="truncate font-medium">{row.prompt || "(no prompt stored)"}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatDateTime(row.createdAt)}
                    {row.shared ? " · Share link created" : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </PanelCard>
      </div>

      <PanelCard title="Admin activity on this user" hint="From the admin audit log" className="mt-4">
        {user.auditTrail.length === 0 ? (
          <EmptyRow text="No admin actions recorded for this user yet." />
        ) : (
          <ul className="divide-y divide-border">
            {user.auditTrail.map((row) => (
              <li key={row.id} className="flex flex-wrap items-baseline justify-between gap-3 px-5 py-3 text-sm">
                <span>
                  <span className="font-medium">{row.action}</span>
                  <span className="text-muted-foreground"> · {row.actorEmail}</span>
                </span>
                <span className="text-xs text-muted-foreground">{formatDateTime(row.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </PanelCard>
    </>
  );
}
