import { notFound, redirect } from "next/navigation";
import { resolveDeskSection } from "@/lib/desk-routes";
import { BillingPlans } from "@/components/desk/billing-plans";
import { SettingsHub } from "@/components/desk/settings-hub";
import { UsageDashboard } from "@/components/desk/usage-dashboard";
import { ImageGeneratorPanel } from "@/components/desk/image-generator";
import { getCurrentUser } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { billingIsMock, billingProvider } from "@/lib/billing";
import { billingSuccessBanner } from "@/lib/billing-ui";
import { parseWorkspaceRole, roleCan } from "@/lib/rbac";
import { prisma } from "@/lib/db";

async function BillingPage({
  workspaceId,
  query,
}: {
  workspaceId: string;
  query: { status?: string; plan?: string; checkout?: string; support?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
  });
  if (!workspace) redirect("/desk");
  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: user.id } },
    select: { role: true },
  });
  const canCheckout = roleCan(parseWorkspaceRole(member?.role), "billing");
  const provider = billingProvider();

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10">
      <p className="page-kicker">Billing</p>
      <h1 className="font-heading mt-1 text-2xl tracking-tight">Plans</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Pro is $20/month for 2 seats and 50k credits. Pro Plus is $79/month for 5
        seats and 200k credits. Ultra is $200/month for 12 seats and 600k credits.
        Credit budgets (tokens 1:1) are enforced by plan.
        There is no self-serve model key field — keys stay on the server.
      </p>
      {query.status === "success" ? (
        <p className="mt-4 rounded-lg border border-border bg-card px-3 py-2 text-sm">
          {billingSuccessBanner(provider)}
        </p>
      ) : null}
      <div className="mt-6">
        <BillingPlans
          workspaceId={workspace.id}
          currentPlan={workspace.plan}
          mock={billingIsMock()}
          provider={provider}
          requestedPlan={query.plan || query.checkout}
          checkoutStatus={query.status}
          canCheckout={canCheckout}
        />
      </div>
    </div>
  );
}

async function SettingsPage({ workspaceId }: { workspaceId: string }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
  });
  if (!workspace) redirect("/desk");

  const account = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true, googleId: true, supporter: true, supporterTotalCents: true },
  });

  return (
    <SettingsHub
      workspaceId={workspace.id}
      workspaceName={workspace.name}
      user={{
        ...user,
        hasPassword: Boolean(account?.passwordHash),
        googleLinked: Boolean(account?.googleId),
        isAdmin: isAdminEmail(user.email),
        supporter: Boolean(account?.supporter) || Boolean(workspace.supporter),
        supporterTotalCents:
          (account?.supporterTotalCents ?? 0) || workspace.supporterTotalCents,
      }}
    />
  );
}

async function UsagePage({ workspaceId }: { workspaceId: string }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true },
  });
  if (!workspace) redirect("/desk");
  return <UsageDashboard workspaceId={workspace.id} />;
}

export default async function WorkspaceSectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceId: string; section?: string[] }>;
  searchParams: Promise<{
    tab?: string;
    status?: string;
    plan?: string;
    checkout?: string;
    support?: string;
  }>;
}) {
  const { workspaceId, section } = await params;
  const query = await searchParams;
  const resolved = resolveDeskSection(section);

  if (resolved.kind === "not-found") notFound();
  if (resolved.kind === "home") {
    // The desk's old Mission Control home retired with the agent desk.
    // Chat is the product home now.
    redirect("/chat");
  }

  const head = resolved.section;
  if (head === "billing") {
    return <BillingPage workspaceId={workspaceId} query={query} />;
  }
  if (head === "settings") {
    return <SettingsPage workspaceId={workspaceId} />;
  }
  if (head === "usage") {
    return <UsagePage workspaceId={workspaceId} />;
  }
  if (head === "image-gen") {
    return <ImageGeneratorPanel workspaceId={workspaceId} />;
  }
  notFound();
}
