import { notFound, redirect } from "next/navigation";
import { ChatDesk } from "@/components/desk/chat-desk";
import { getCurrentUser } from "@/lib/auth";
import { AGENT_ROLES, type AgentRole } from "@/lib/constants";
import { prisma } from "@/lib/db";

export default async function AgentPage({
  params,
}: {
  params: Promise<{ workspaceId: string; agent: string }>;
}) {
  const { workspaceId, agent } = await params;
  if (!AGENT_ROLES.includes(agent as AgentRole)) notFound();
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
  });
  if (!workspace) redirect("/desk");

  const conversation = await prisma.conversation.findUnique({
    where: {
      workspaceId_agentRole: { workspaceId, agentRole: agent },
    },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
      artifacts: { orderBy: { createdAt: "desc" }, take: 8 },
    },
  });

  return (
    <ChatDesk
      workspaceId={workspaceId}
      agent={agent as AgentRole}
      initialMessages={conversation?.messages ?? []}
      initialArtifacts={conversation?.artifacts ?? []}
      tokenUsed={workspace.tokenUsed}
      tokenBudget={workspace.tokenBudget}
    />
  );
}
