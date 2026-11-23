import { requireUser } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { enforceSensitiveRateLimit } from "@/lib/rate-limit";
import {
  publishSiteProject,
  unpublishSiteProject,
} from "@/lib/site-builder";

type Ctx = { params: Promise<{ projectId: string }> };

/** Publish (or re-publish) the project's current version to its subdomain. */
export async function POST(request: Request, context: Ctx) {
  try {
    await enforceSensitiveRateLimit(
      request,
      ["api", "builder", "publish"],
      "POST",
    );
    const user = await requireUser();
    const { projectId } = await context.params;
    const result = await publishSiteProject({ userId: user.id, projectId });
    return jsonOk(result);
  } catch (error) {
    return jsonError(error);
  }
}

/** Take the live site down (the subdomain is kept for the owner). */
export async function DELETE(request: Request, context: Ctx) {
  try {
    await enforceSensitiveRateLimit(
      request,
      ["api", "builder", "publish"],
      "DELETE",
    );
    const user = await requireUser();
    const { projectId } = await context.params;
    const result = await unpublishSiteProject({ userId: user.id, projectId });
    return jsonOk(result);
  } catch (error) {
    return jsonError(error);
  }
}
