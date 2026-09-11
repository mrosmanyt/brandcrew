import { Suspense } from "react";
import { redirect } from "next/navigation";
import { DeskChromeHeader } from "@/components/desk/desk-chrome";
import { DeskSidebar } from "@/components/desk/sidebar";
import { SetupBanner } from "@/components/desk/setup-banner";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { serializeAgent, employeeStatusFromJobs } from "@/lib/job-serialize";
import { limitsForPlan } from "@/lib/limits";
import { listUserWorkspaces, serializeWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: user.id } },
    include: {
      workspace: {
        include: {
          artifacts: { orderBy: { createdAt: "desc" } },
          jobs: {
            where: { status: { in: ["queued", "running", "needs_you"] } },
            orderBy: { updatedAt: "desc" },
          },
          agents: {
            where: { status: { not: "archived" } },
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          },
        },
      },
    },
  });
  if (!member) redirect("/desk");

  const workspaces = (await listUserWorkspaces(user.id)).map(serializeWorkspace);
  const agentStatus: Record<string, string> = {
    ...employeeStatusFromJobs(member.workspace.jobs),
  };
  for (const artifact of member.workspace.artifacts) {
    const key = artifact.agentId || artifact.agentRole;
    if (!agentStatus[key] || agentStatus[key] === "idle") {
      agentStatus[key] = artifact.status;
    }
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background md:flex-row">
      <Suspense
        fallback={
          <aside className="hidden h-dvh w-60 shrink-0 border-r border-sidebar-border bg-sidebar md:block" />
        }
      >
        <DeskSidebar
          workspace={serializeWorkspace({ ...member.workspace, memberRole: member.role })}
          workspaces={workspaces}
          agents={member.workspace.agents.map(serializeAgent)}
          agentStatus={agentStatus}
          needsYou={member.workspace.jobs
            .filter((job) => job.status === "needs_you")
            .map((job) => ({
              id: job.id,
              title: job.title,
              agentId: job.agentId,
              status: job.status,
              updatedAt: job.updatedAt.toISOString(),
            }))}
        />
      </Suspense>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <SetupBanner />
        <DeskChromeHeader
          workspaceId={member.workspace.id}
          tokensLeft={Math.max(
            0,
            (member.workspace.tokenBudget || limitsForPlan(member.workspace.plan).tokenBudget) -
              member.workspace.tokenUsed,
          )}
          tokenBudget={
            member.workspace.tokenBudget || limitsForPlan(member.workspace.plan).tokenBudget
          }
          jobsLeft={limitsForPlan(member.workspace.plan).jobsPerHour}
          plan={limitsForPlan(member.workspace.plan).plan}
          supporter={Boolean(member.workspace.supporter)}
          needsYou={member.workspace.jobs
            .filter((job) => job.status === "needs_you")
            .map((job) => ({
              id: job.id,
              title: job.title,
              agentId: job.agentId,
              status: job.status,
              updatedAt: job.updatedAt.toISOString(),
            }))}
        />
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
