import { requireWorkspaceMember } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";
import { serializeAgent } from "@/lib/job-serialize";
import { FEATURED_JOB_TEMPLATES } from "@/lib/job-templates";
import {
  MARKETPLACE_BOTS,
  MARKETPLACE_PLUGINS,
} from "@/lib/marketplace";
import { listPluginConnections } from "@/lib/plugins";

export async function GET(
  _request: Request,
  context: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const { workspaceId } = await context.params;
    await requireWorkspaceMember(workspaceId);
    const [agents, plugins] = await Promise.all([
      prisma.agent.findMany({
        where: { workspaceId, status: { not: "archived" } },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      }),
      listPluginConnections(workspaceId),
    ]);
    const addedTemplateIds = agents
      .map((agent) => agent.templateId)
      .filter((id): id is string => Boolean(id));
    return jsonOk({
      bots: MARKETPLACE_BOTS.map((bot) => ({
        ...bot,
        added: addedTemplateIds.includes(bot.id),
      })),
      plugins: MARKETPLACE_PLUGINS.map((plugin) => {
        const connection = plugins.find((row) => row.pluginId === plugin.id);
        return {
          ...plugin,
          connection: connection ?? null,
          connected: connection?.connected ?? false,
        };
      }),
      agents: agents.map(serializeAgent),
      installedPluginCount: plugins.filter((row) => row.connected).length,
      templates: FEATURED_JOB_TEMPLATES,
    });
  } catch (error) {
    return jsonError(error);
  }
}
