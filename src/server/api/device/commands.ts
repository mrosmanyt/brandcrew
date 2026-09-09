import { requireDevice } from "@/lib/device-auth";
import { parseCommandArgs } from "@/lib/device-commands";
import { prisma } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";

export async function GET(request: Request) {
  try {
    const device = await requireDevice(request);
    const nativeOnly = new URL(request.url).searchParams.get("native") === "1";
    const commands = await prisma.deviceCommand.findMany({
      where: {
        deviceId: device.id,
        status: "queued",
        ...(nativeOnly ? { tool: { startsWith: "native_" } } : {}),
      },
      orderBy: { createdAt: "asc" },
      take: 4,
    });
    if (commands.length) {
      await prisma.deviceCommand.updateMany({
        where: { id: { in: commands.map((row) => row.id) } },
        data: { status: "running" },
      });
    }
    return jsonOk({
      workspaceId: device.workspaceId,
      commands: commands.map((row) => ({
        id: row.id,
        jobId: row.jobId,
        stepId: row.stepId,
        tool: row.tool,
        args: parseCommandArgs(row.args),
      })),
    });
  } catch (error) {
    return jsonError(error);
  }
}
