import { prisma } from "@/lib/db";

export async function recordWorkspaceAudit(input: {
  workspaceId: string;
  jobId?: string | null;
  deviceId?: string | null;
  actor?: string;
  action: string;
  detail?: string;
  data?: Record<string, unknown>;
}) {
  await prisma.workspaceAudit.create({
    data: {
      workspaceId: input.workspaceId,
      jobId: input.jobId ?? null,
      deviceId: input.deviceId ?? null,
      actor: input.actor || "system",
      action: input.action,
      detail: (input.detail || "").slice(0, 2000),
      data: JSON.stringify(input.data ?? {}),
    },
  });
}

export function serializeAudit(row: {
  id: string;
  workspaceId: string;
  jobId: string | null;
  deviceId: string | null;
  actor: string;
  action: string;
  detail: string;
  data: string;
  createdAt: Date;
}) {
  let data: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(row.data || "{}");
    if (parsed && typeof parsed === "object") data = parsed as Record<string, unknown>;
  } catch {
    data = {};
  }
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    jobId: row.jobId,
    deviceId: row.deviceId,
    actor: row.actor,
    action: row.action,
    detail: row.detail,
    data,
    createdAt: row.createdAt.toISOString(),
  };
}
