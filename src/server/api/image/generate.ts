import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { withNativeCors } from "@/lib/auth-native";
import { generateImageForUser, getImageGenStatusForUser } from "@/lib/image-generation";
import { IMAGE_PROMPT_MAX } from "@/lib/image-generation-pure";
import { jsonError, jsonOk } from "@/lib/http";
import { enforceSensitiveRateLimit } from "@/lib/rate-limit";

const postSchema = z.object({
  prompt: z.string().trim().min(3).max(IMAGE_PROMPT_MAX),
});

export async function GET() {
  try {
    const user = await requireUser();
    const status = await getImageGenStatusForUser(user.id);
    return withNativeCors(jsonOk(status));
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    await enforceSensitiveRateLimit(request, ["api", "image", "generate"], "POST");
    const user = await requireUser();
    const body = postSchema.parse(await request.json());
    const result = await generateImageForUser(user.id, body.prompt);
    return withNativeCors(jsonOk(result));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Write a short image prompt (3–800 characters).", code: "invalid_request" },
        { status: 400 },
      );
    }
    return jsonError(error);
  }
}
