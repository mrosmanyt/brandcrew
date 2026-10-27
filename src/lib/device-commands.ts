import { prisma } from "@/lib/db";
import { recordWorkspaceAudit } from "@/lib/audit";
import {
  DEVICE_COMMAND_WAIT_MS,
  isDeviceOnline,
  type DeviceCommandResult,
  type DeviceTool,
} from "@/lib/device-protocol";

const POLL_MS = 400;

export async function findOnlineDevice(workspaceId: string) {
  const devices = await prisma.localDevice.findMany({
    where: { workspaceId, status: { in: ["online", "offline"] } },
    orderBy: { lastSeenAt: "desc" },
    take: 8,
  });
  return devices.find((row) => row.status !== "revoked" && isDeviceOnline(row.lastSeenAt)) ?? null;
}

export async function findPairedDevice(workspaceId: string) {
  return prisma.localDevice.findFirst({
    where: { workspaceId, status: { in: ["online", "offline"] } },
    orderBy: { lastSeenAt: "desc" },
  });
}

export async function enqueueDeviceCommand(input: {
  workspaceId: string;
  jobId: string;
  stepId: string;
  tool: DeviceTool;
  args: Record<string, unknown>;
  allowedDomains: string[];
}): Promise<{ commandId: string; deviceId: string } | null> {
  const device = await findOnlineDevice(input.workspaceId);
  if (!device) return null;
  const command = await prisma.deviceCommand.create({
    data: {
      deviceId: device.id,
      jobId: input.jobId,
      stepId: input.stepId,
      tool: input.tool,
      args: JSON.stringify({ ...input.args, allowedDomains: input.allowedDomains }),
      status: "queued",
    },
  });
  await recordWorkspaceAudit({
    workspaceId: input.workspaceId,
    jobId: input.jobId,
    deviceId: device.id,
    actor: "device",
    action: "device_command",
    detail: `${input.tool} queued on ${device.name}`,
    data: { tool: input.tool, commandId: command.id },
  });
  return { commandId: command.id, deviceId: device.id };
}

export async function waitForDeviceCommand(
  commandId: string,
  timeoutMs = DEVICE_COMMAND_WAIT_MS,
): Promise<DeviceCommandResult | null> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const row = await prisma.deviceCommand.findUnique({ where: { id: commandId } });
    if (!row) return null;
    if (row.status === "done" || row.status === "failed" || row.status === "aborted") {
      try {
        return JSON.parse(row.result || "{}") as DeviceCommandResult;
      } catch {
        return { ok: false, error: row.result || "Device command returned invalid JSON." };
      }
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
  await prisma.deviceCommand.updateMany({
    where: { id: commandId, status: { in: ["queued", "running"] } },
    data: { status: "failed", result: JSON.stringify({ ok: false, error: "Device command timed out." }) },
  });
  return null;
}

export function parseCommandArgs(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw || "{}");
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
