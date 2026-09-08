import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { ApiConsole } from "@/components/desk/api-console";
import { BillingPlans } from "@/components/desk/billing-plans";
import { BrandKitForm } from "@/components/desk/brand-kit-form";
import { CalendarView } from "@/components/desk/calendar-view";
import { KanbanBoard } from "@/components/desk/kanban-board";
import { MarketplaceDesk } from "@/components/desk/marketplace";
import { MissionControl } from "@/components/desk/mission-control";
import { SettingsHub } from "@/components/desk/settings-hub";
import { UsageDashboard } from "@/components/desk/usage-dashboard";
import { getCurrentUser } from "@/lib/auth";
import { workspaceOnboarding } from "@/lib/onboarding";
import { billingIsMock, billingProvider } from "@/lib/billing";
import { billingSuccessBanner } from "@/lib/billing-ui";
import { parseBrandKit } from "@/lib/brand-kit";
import { prisma } from "@/lib/db";
import { serializeAgent, serializeJob, serializeSkill } from "@/lib/job-serialize";
import { getWorkspaceLimits, serializeLimits } from "@/lib/limits";
import { getLlmStatus } from "@/lib/llm";
import { normalizeModelRouting } from "@/lib/llm-routing";
import type { ArtifactDTO, MessageDTO } from "@/lib/types";

async function MissionControlPage({
  workspaceId,
  query,
}: {
  workspaceId: string;
  query: { agent?: string; agentId?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
  });
  if (!workspace) redirect("/desk");

  const [agents, jobs, skills, conversations, membership] = await Promise.all([
    prisma.agent.findMany({
      where: { workspaceId, status: { not: "archived" } },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    prisma.job.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      take: 40,
      include: {
        events: { orderBy: { createdAt: "asc" }, take: 80 },
        artifacts: { orderBy: { createdAt: "asc" } },
      },
    }),
    prisma.skill.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.conversation.findMany({
      where: { workspaceId },
      include: {
        messages: { orderBy: { createdAt: "asc" } },
        artifacts: { orderBy: { createdAt: "desc" }, take: 8 },
      },
    }),
    prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: workspace.id, userId: user.id } },
      select: { onboardingDismissed: true },
    }),
  ]);

  const initialMessages: Record<string, MessageDTO[]> = {};
  const initialArtifacts: Record<string, ArtifactDTO[]> = {};
  for (const agent of agents) {
    initialMessages[agent.id] = [];
    initialArtifacts[agent.id] = [];
  }
  for (const conversation of conversations) {
    const key = conversation.agentId || conversation.agentRole;
    initialMessages[key] = conversation.messages;
    initialArtifacts[key] = conversation.artifacts;
  }

  return (
    <Suspense fallback={<div className="flex-1" />}>
      <MissionControl
        workspaceId={workspace.id}
        initialAgentId={query.agentId || query.agent}
        initialAgents={agents.map(serializeAgent)}
        initialJobs={jobs.map(serializeJob)}
        initialSkills={skills.map(serializeSkill)}
        initialMessages={initialMessages}
        initialArtifacts={initialArtifacts}
        tokenUsed={workspace.tokenUsed}
        tokenBudget={workspace.tokenBudget}
        initialLimits={serializeLimits(await getWorkspaceLimits(workspace.id))}
        initialOnboarding={workspaceOnboarding({
          dismissed: Boolean(membership?.onboardingDismissed),
          agentCount: agents.length,
          jobCount: jobs.length,
          approvedCount: jobs.reduce(
            (count, job) =>
              count + job.artifacts.filter((artifact) => artifact.status === "approved").length,
            0,
          ),
        })}
        initialLlm={getLlmStatus()}
        billingMock={billingIsMock()}
        initialModelRouting={normalizeModelRouting(
          "modelRouting" in workspace
            ? String((workspace as { modelRouting?: string }).modelRouting ?? "")
            : "",
        )}
      />
    </Suspense>
  );
}

async function BillingPage({
  workspaceId,
  query,
}: {
  workspaceId: string;
  query: { status?: string; plan?: string };
}) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
  });
  if (!workspace) redirect("/desk");

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10">
      <p className="page-kicker">Billing</p>
      <h1 className="font-heading mt-1 text-2xl tracking-tight">Plans</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Starter is $20/month for 2 seats and 50k tokens. Pro is $79/month for 5
        seats and 200k tokens. Ultra is $200/month for 12 seats and 600k tokens.
        Token budgets, jobs per hour, and concurrent jobs are enforced by plan.
        There is no self-serve model key field — keys stay on the server.
      </p>
      {query.status === "success" ? (
        <p className="mt-4 rounded-lg border border-border bg-card px-3 py-2 text-sm">
          {billingSuccessBanner(billingProvider())}
        </p>
      ) : null}
      <div className="mt-6">
        <BillingPlans
          workspaceId={workspace.id}
          currentPlan={workspace.plan}
          mock={billingIsMock()}
          provider={billingProvider()}
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
    select: { passwordHash: true, googleId: true },
  });

  const [jobs, agents] = await Promise.all([
    prisma.job.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      take: 40,
      include: {
        events: { orderBy: { createdAt: "asc" }, take: 80 },
        artifacts: { orderBy: { createdAt: "asc" } },
      },
    }),
    prisma.agent.findMany({
      where: { workspaceId, status: { not: "archived" } },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  return (
    <SettingsHub
      workspaceId={workspace.id}
      workspaceName={workspace.name}
      user={{
        ...user,
        hasPassword: Boolean(account?.passwordHash),
        googleLinked: Boolean(account?.googleId),
      }}
      initialJobs={jobs.map(serializeJob)}
      agents={agents.map(serializeAgent)}
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
  const agents = await prisma.agent.findMany({
    where: { workspaceId, status: { not: "archived" } },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return <UsageDashboard workspaceId={workspace.id} agents={agents.map(serializeAgent)} />;
}

async function DevelopersPage({ workspaceId }: { workspaceId: string }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true },
  });
  if (!workspace) redirect("/desk");

  return (
    <div className="desk-page max-w-5xl">
      <p className="page-kicker">Developers</p>
      <h1 className="font-heading mt-1 text-2xl tracking-tight">API Console</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
        Mint a workspace key and call CINEM Pro over HTTPS. Bearer tokens never
        include model provider secrets. Jobs use the live runtime — Slack/Gmail
        send still waits for you in the desk.
      </p>
      <div className="mt-6">
        <ApiConsole workspaceId={workspace.id} />
      </div>
    </div>
  );
}

async function BrandKitPage({ workspaceId }: { workspaceId: string }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
  });
  if (!workspace) redirect("/desk");

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-10">
      <p className="page-kicker">Brand Kit</p>
      <h1 className="font-heading mt-1 text-2xl tracking-tight">Brand Kit</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Stored as JSON on this workspace. Save, then generate — Writer, Sales,
        and the rest will use this kit immediately. There is no per-agent memory
        in v1.
      </p>
      <div className="mt-8 rounded-2xl border border-border bg-card p-6">
        <BrandKitForm
          workspaceId={workspace.id}
          workspaceName={workspace.name}
          initial={parseBrandKit(workspace.brandKit)}
        />
      </div>
    </div>
  );
}

export default async function WorkspaceSectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceId: string; section?: string[] }>;
  searchParams: Promise<{
    agent?: string;
    agentId?: string;
    tab?: string;
    status?: string;
    plan?: string;
  }>;
}) {
  const { workspaceId, section } = await params;
  const query = await searchParams;
  const parts = section ?? [];

  if (parts.length === 0) {
    return <MissionControlPage workspaceId={workspaceId} query={query} />;
  }
  if (parts.length > 1) notFound();

  const head = parts[0];
  if (head === "calendar") {
    return (
      <div className="mx-auto w-full max-w-3xl px-6 py-10">
        <p className="page-kicker">Calendar</p>
        <h1 className="font-heading mt-1 text-2xl tracking-tight">Content calendar</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          A 30-day plan you can export as Markdown and paste into Docs. CINEM Pro
          does not auto-post to LinkedIn.
        </p>
        <div className="mt-6">
          <CalendarView workspaceId={workspaceId} />
        </div>
      </div>
    );
  }
  if (head === "ops") {
    return (
      <div className="mx-auto w-full max-w-5xl px-6 py-10">
        <p className="page-kicker">Ops</p>
        <h1 className="font-heading mt-1 text-2xl tracking-tight">Task board</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Three columns only: approve, schedule, done. Approving an artifact
          creates a schedule task here. This is not a full project tool.
        </p>
        <div className="mt-6">
          <KanbanBoard workspaceId={workspaceId} />
        </div>
      </div>
    );
  }
  if (head === "marketplace") {
    return <MarketplaceDesk workspaceId={workspaceId} initialTab={query.tab} />;
  }
  if (head === "billing") {
    return <BillingPage workspaceId={workspaceId} query={query} />;
  }
  if (head === "brand-kit") {
    return <BrandKitPage workspaceId={workspaceId} />;
  }
  if (head === "developers") {
    return <DevelopersPage workspaceId={workspaceId} />;
  }
  if (head === "settings") {
    return <SettingsPage workspaceId={workspaceId} />;
  }
  if (head === "usage") {
    return <UsagePage workspaceId={workspaceId} />;
  }
  redirect(`/desk/${workspaceId}?agentId=${encodeURIComponent(head)}`);
}
