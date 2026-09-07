import { redirect } from "next/navigation";
import { MissionControl } from "@/components/desk/mission-control";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { serializeAgent, serializeJob, serializeSkill } from "@/lib/job-serialize";
import type { ArtifactDTO, MessageDTO } from "@/lib/types";

export default async function WorkspaceHomePage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceId: string }>;
  searchParams: Promise<{ agent?: string; agentId?: string }>;
}) {
  const { workspaceId } = await params;
  const query = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
  });
  if (!workspace) redirect("/desk");

  const [agents, jobs, skills, conversations] = await Promise.all([
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
    />
  );
}
