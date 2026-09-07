import { prisma } from "@/lib/db";
import { calendarItemsFromApprovedArtifact } from "@/lib/artifact-calendar";

export async function applyArtifactApproval(input: {
  workspaceId: string;
  artifact: {
    id: string;
    title: string;
    content: string;
    agentRole: string;
    type: string;
  };
}) {
  const existingTask = await prisma.task.findFirst({
    where: { workspaceId: input.workspaceId, artifactId: input.artifact.id },
  });
  if (!existingTask) {
    await prisma.task.create({
      data: {
        workspaceId: input.workspaceId,
        artifactId: input.artifact.id,
        title: `Schedule/publish ${input.artifact.title}`,
        description: `Approved ${input.artifact.agentRole} artifact — move this when it is on the calendar.`,
        status: "schedule",
      },
    });
  }

  const shouldCalendize =
    input.artifact.agentRole === "writer" ||
    input.artifact.agentRole === "sales" ||
    input.artifact.agentRole === "ads" ||
    input.artifact.type === "writer_week" ||
    input.artifact.type === "sales_pack" ||
    input.artifact.type === "outreach_pack";

  if (!shouldCalendize) return { taskCreated: !existingTask, calendarAdded: 0 };

  const existingItems = await prisma.calendarItem.count({
    where: { workspaceId: input.workspaceId, artifactId: input.artifact.id },
  });
  if (existingItems > 0) {
    return { taskCreated: !existingTask, calendarAdded: existingItems };
  }

  const seeds = calendarItemsFromApprovedArtifact({
    artifactId: input.artifact.id,
    agentRole: input.artifact.agentRole,
    title: input.artifact.title,
    content: input.artifact.content,
  });
  await prisma.calendarItem.createMany({
    data: seeds.map((item) => ({
      workspaceId: input.workspaceId,
      date: item.date,
      channel: item.channel,
      title: item.title,
      content: item.content,
      artifactId: input.artifact.id,
    })),
  });
  return { taskCreated: !existingTask, calendarAdded: seeds.length };
}
