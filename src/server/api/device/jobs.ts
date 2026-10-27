import { NextResponse } from "next/server";
import { z } from "zod";
import { composerAttachmentsSchema } from "@/lib/composer-media";
import { requireDevice } from "@/lib/device-auth";
import { createDeviceJob, deviceJobsPayload } from "@/lib/device-desk";
import { jsonError, jsonOk } from "@/lib/http";
import { BudgetError } from "@/lib/usage";

const postSchema = z.object({
  agentId: z.string().min(1),
  message: z.string().max(4000).optional(),
  playbookKey: z.string().max(80).optional(),
  attachments: composerAttachmentsSchema,
});

export async function GET(request: Request) {
  try {
    const device = await requireDevice(request);
    const agentId = new URL(request.url).searchParams.get("agentId") || "";
    return jsonOk(await deviceJobsPayload(device, agentId || undefined));
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const device = await requireDevice(request);
    const body = postSchema.parse(await request.json());
    return jsonOk(await createDeviceJob(device, body));
  } catch (error) {
    if (error instanceof BudgetError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Choose an agent and write a short job." }, { status: 400 });
    }
    return jsonError(error);
  }
}
