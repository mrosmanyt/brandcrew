import { NextResponse } from "next/server";
import { z } from "zod";
import { assistantProRequiredJson } from "@/lib/assistant-pro-access";
import {
  assistantUsageHttpStatus,
  shouldHardLockAssistant,
  type CinemAiAssistantUsageSnapshot,
} from "@/lib/cinem-ai-assistant";
import {
  getCinemAssistantUsage,
  incrementCinemAssistantUsage,
  requireCinemAssistantCaller,
} from "@/lib/cinem-ai-assistant-usage";
import { jsonError } from "@/lib/http";

const USAGE_HEADERS = {
  "Cache-Control": "private, no-store, no-cache, must-revalidate",
  Vary: "Authorization, Cookie",
};

function jsonUsage(snapshot: CinemAiAssistantUsageSnapshot, status = 200) {
  return NextResponse.json(snapshot, { status, headers: USAGE_HEADERS });
}

const incrementSchema = z
  .object({
    product: z.string().optional(),
    turns: z.number().optional(),
  })
  .optional();

export async function GET(request: Request) {
  try {
    const caller = await requireCinemAssistantCaller(request);
    const snapshot = await getCinemAssistantUsage(request, caller);
    if (shouldHardLockAssistant(snapshot)) {
      return assistantProRequiredJson(snapshot, { headers: USAGE_HEADERS });
    }
    return jsonUsage(snapshot);
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
    if (shouldHardLockAssistant(snapshot)) {
      return assistantProRequiredJson(
        { upgradeUrl: snapshot.upgradeUrl, whatsappUrl: snapshot.whatsappUrl },
        { headers: USAGE_HEADERS },
      );
    }
    return jsonUsage(snapshot, assistantUsageHttpStatus(snapshot));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid usage payload." }, { status: 400 });
    }
    return jsonError(error);
  }
}
