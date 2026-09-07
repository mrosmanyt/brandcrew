import { redirect } from "next/navigation";

export default async function AgentPage({
  params,
}: {
  params: Promise<{ workspaceId: string; agent: string }>;
}) {
  const { workspaceId, agent } = await params;
  redirect(`/desk/${workspaceId}?agentId=${encodeURIComponent(agent)}`);
}
