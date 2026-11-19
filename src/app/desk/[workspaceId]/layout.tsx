import { Suspense } from "react";
import { redirect } from "next/navigation";
import { DeskChromeHeader } from "@/components/desk/desk-chrome";
import { DeskSidebar } from "@/components/desk/sidebar";
import { SetupBanner } from "@/components/desk/setup-banner";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { creditsFromTokens, formatCreditsLine } from "@/lib/credits";
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
    include: { workspace: true },
  });
  if (!member) redirect("/desk");

  const workspaces = (await listUserWorkspaces(user.id)).map(serializeWorkspace);

  const tokenBudget =
    member.workspace.tokenBudget || limitsForPlan(member.workspace.plan).tokenBudget;
  const creditsLine = formatCreditsLine(
    creditsFromTokens(member.workspace.tokenUsed, tokenBudget),
  );

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
          creditsLine={creditsLine}
        />
      </Suspense>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <SetupBanner />
        <DeskChromeHeader
          workspaceId={member.workspace.id}
          tokensLeft={Math.max(0, tokenBudget - member.workspace.tokenUsed)}
          tokenBudget={tokenBudget}
          plan={limitsForPlan(member.workspace.plan).plan}
          supporter={Boolean(member.workspace.supporter)}
        />
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
