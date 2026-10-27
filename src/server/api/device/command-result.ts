import { NextResponse } from "next/server";
import { z } from "zod";
import { requireDevice } from "@/lib/device-auth";
import { prisma } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";
import { recordWorkspaceAudit } from "@/lib/audit";

const schema = z.object({
  ok: z.boolean(),
  error: z.string().max(2000).optional(),
  excerpt: z.string().max(8000).optional(),
  extracted: z.string().max(20_000).optional(),
  screenshot: z.string().max(250_000).optional(),
  fileText: z.string().max(20_000).optional(),
  engine: z.string().max(40).optional(),
  abortedDomain: z.string().max(200).optional(),
  page: z
    .object({
      url: z.string(),
      ok: z.boolean(),
      title: z.string().optional(),
      text: z.string().max(20_000),
      excerpt: z.string().max(8000),
      links: z.array(z.string()).optional(),
      engine: z.string().optional(),
      error: z.string().optional(),
    })
    .optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ commandId: string }> },
) {
  try {
    const device = await requireDevice(request);
    const { commandId } = await context.params;
    const command = await prisma.deviceCommand.findFirst({
      where: { id: commandId, deviceId: device.id },
    });
    if (!command) {
      return NextResponse.json({ error: "Command not found." }, { status: 404 });
    }
    const body = schema.parse(await request.json());
    const status = body.abortedDomain ? "aborted" : body.ok ? "done" : "failed";
    await prisma.deviceCommand.update({
      where: { id: command.id },
      data: {
        status,
        result: JSON.stringify(body),
      },
    });
    await recordWorkspaceAudit({
      workspaceId: device.workspaceId,
      jobId: command.jobId,
      deviceId: device.id,
      actor: "device",
      action: "device_result",
      detail: `${command.tool} ${status}`,
      data: { commandId: command.id, ok: body.ok, url: body.page?.url },
    });
    return jsonOk({ ok: true, status });
  } catch (error) {
    return jsonError(error);
  }
}
