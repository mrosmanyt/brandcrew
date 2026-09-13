import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getCinemAssistantUsage,
  incrementCinemAssistantUsage,
  requireCinemAssistantCaller,
} from "@/lib/cinem-ai-assistant-usage";
import { jsonError, jsonOk } from "@/lib/http";

const incrementSchema = z
  .object({
    product: z.string().optional(),
    turns: z.number().optional(),
  })
  .optional();

export async function GET(request: Request) {
  try {
    const caller = await requireCinemAssistantCaller(request);
    return jsonOk(await getCinemAssistantUsage(request, caller));
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const caller = await requireCinemAssistantCaller(request);
    let turns: unknown;
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const body = incrementSchema.parse(await request.json().catch(() => ({})));
      turns = body?.turns;
    }
    const snapshot = await incrementCinemAssistantUsage(request, caller, turns);
    if (!snapshot.allowed) {
      return NextResponse.json(snapshot, { status: 402 });
    }
    return jsonOk(snapshot);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid usage payload." }, { status: 400 });
    }
    return jsonError(error);
  }
}
