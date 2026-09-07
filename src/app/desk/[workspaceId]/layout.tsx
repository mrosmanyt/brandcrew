import { redirect } from "next/navigation";
import { DeskHeader } from "@/components/desk/desk-header";
import { DeskSidebar } from "@/components/desk/sidebar";
import { SetupBanner } from "@/components/desk/setup-banner";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { employeeStatusFromJobs } from "@/lib/job-serialize";
import { getLlmStatus } from "@/lib/llm";
import { listUserWorkspaces, serializeWorkspace } from "@/lib/workspace";

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
    if (!agentStatus[artifact.agentRole] || agentStatus[artifact.agentRole] === "idle") {
      agentStatus[artifact.agentRole] = artifact.status;
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background md:flex-row">
      <DeskSidebar
        workspace={serializeWorkspace(member.workspace)}
        workspaces={workspaces}
        agentStatus={agentStatus}
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <SetupBanner />
        <DeskHeader workspace={serializeWorkspace(member.workspace)} llm={getLlmStatus()} />
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </div>
    </div>
  );
}
