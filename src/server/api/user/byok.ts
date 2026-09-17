import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { patchProviderKeys, readByokSnapshot } from "@/lib/user-provider-keys";
import { withNativeCors } from "@/lib/auth-native";

export async function GET() {
  try {
    const user = await requireUser();
    const snapshot = await readByokSnapshot(user.id);
    return withNativeCors(jsonOk({ byok: snapshot }));
  } catch (error) {
    return jsonError(error);
  }
}

const patchSchema = z.object({
  geminiKey: z.string().max(200).optional().nullable(),
  deepgramKey: z.string().max(200).optional().nullable(),
  spendCapUsd: z.number().min(1).max(500).optional(),
});

export async function PATCH(request: Request) {
  try {
    const user = await requireUser();
    const body = patchSchema.parse(await request.json());
    const snapshot = await patchProviderKeys(user.id, body);
    return withNativeCors(jsonOk({ byok: snapshot }));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid BYOK payload." }, { status: 400 });
    }
    return jsonError(error);
  }
}
