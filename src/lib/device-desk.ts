import { prisma } from "@/lib/db";
import { SITE_ORIGIN } from "@/lib/site";
import type { ComposerAttachment } from "@/lib/composer";
import { isLightweightDeskQuestion, answerDeskQuestion } from "@/lib/desk-qa";
import { createJobFromChat } from "@/lib/job-runtime";
import { liveProgressFromEvents } from "@/lib/live-progress";
import { getWorkspaceLimits, serializeLimits } from "@/lib/limits";
import { employeeStatusFromJobs, serializeAgent, serializeJob } from "@/lib/job-serialize";
import { displayAgentName } from "@/lib/constants";
import type { AuthedDevice } from "@/lib/device-auth";

export async function deviceSessionPayload(device: AuthedDevice) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: device.workspaceId },
    select: { id: true, name: true },
  });
  const agents = await prisma.agent.findMany({
    where: { workspaceId: device.workspaceId, status: { not: "archived" } },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    take: 40,
  });
  return {
    ok: true,
    extensionConnected: true,
    device: {
      id: device.id,
      name: device.name,
      workspaceId: device.workspaceId,
      online: true,
    },
    workspace: workspace || { id: device.workspaceId, name: "Desk" },
    agents: agents.map((agent) => ({
      ...serializeAgent(agent),
      name: displayAgentName(agent.name),
    })),
    agentId: agents[0]?.id || "",
    deskUrl: `${SITE_ORIGIN}/desk/${device.workspaceId}`,
  };
}

export async function deviceJobsPayload(device: AuthedDevice, agentId?: string) {
  const jobs = await prisma.job.findMany({
    where: {
      workspaceId: device.workspaceId,
      ...(agentId ? { agentId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 12,
    include: {
      events: { orderBy: { createdAt: "asc" }, take: 80 },
      artifacts: { orderBy: { createdAt: "asc" } },
    },
  });
  const serialized = jobs.map(serializeJob);
  const latest = serialized[0] || null;
  let messages: { id: string; role: string; content: string; createdAt: Date }[] = [];
  if (agentId) {
    const conversation = await prisma.conversation.findFirst({
      where: { workspaceId: device.workspaceId, agentId },
      include: { messages: { orderBy: { createdAt: "asc" }, take: 40 } },
    });
    messages = conversation?.messages ?? [];
  }
  const limits = serializeLimits(await getWorkspaceLimits(device.workspaceId));
  return {
    ok: true,
    jobs: serialized,
    job: latest,
    messages,
    progress: latest ? liveProgressFromEvents(latest.events || []) : [],
    employeeStatus: employeeStatusFromJobs(jobs),
    limits,
  };
}

export async function createDeviceJob(
  device: AuthedDevice,
  input: {
    agentId: string;
    message?: string;
    playbookKey?: string;
    attachments?: ComposerAttachment[];
  },
) {
  const message = (input.message || "").trim();
  if (
    isLightweightDeskQuestion({
      message,
      action: "default",
      playbookKey: input.playbookKey,
      skillId: undefined,
      attachments: input.attachments,
    })
  ) {
    const qa = await answerDeskQuestion({
      workspaceId: device.workspaceId,
      agentId: input.agentId,
      message,
      attachments: input.attachments,
    });
    return { ok: true, ...qa };
  }
  const result = await createJobFromChat({
    workspaceId: device.workspaceId,
    agentId: input.agentId,
    message,
    playbookKey: input.playbookKey,
    attachments: input.attachments,
  });
  return { ok: true, ...result };
}
