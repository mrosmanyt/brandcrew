import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { enforceSensitiveRateLimit } from "@/lib/rate-limit";
import { restoreSiteVersion } from "@/lib/site-builder";

type Ctx = { params: Promise<{ projectId: string }> };

const postSchema = z.object({
  versionId: z.string().trim().min(1).max(64),
});

export async function POST(request: Request, context: Ctx) {
  try {
    await enforceSensitiveRateLimit(
      request,
      ["api", "builder", "restore"],
      "POST",
    );
    const user = await requireUser();
    const { projectId } = await context.params;
    const body = postSchema.parse(await request.json());
    const result = await restoreSiteVersion({
      userId: user.id,
      projectId,
      versionId: body.versionId,
    });
    return jsonOk(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonError(new Error("Invalid restore payload."));
    }
    return jsonError(error);
  }
}
