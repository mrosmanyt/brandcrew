import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { enforceSensitiveRateLimit } from "@/lib/rate-limit";
import { generateSiteVersion } from "@/lib/site-builder";

type Ctx = { params: Promise<{ projectId: string }> };

const postSchema = z.object({
  instruction: z.string().trim().min(3).max(4000),
});

export async function POST(request: Request, context: Ctx) {
  try {
    await enforceSensitiveRateLimit(
      request,
      ["api", "builder", "generate"],
      "POST",
    );
    const user = await requireUser();
    const { projectId } = await context.params;
    const body = postSchema.parse(await request.json());
    const result = await generateSiteVersion({
      userId: user.id,
      userName: user.name,
      projectId,
      instruction: body.instruction,
    });
    return jsonOk(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonError(
        new Error("Describe the website or the change you want (a sentence or two)."),
      );
    }
    return jsonError(error);
  }
}
