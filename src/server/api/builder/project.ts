import { requireUser } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { getSiteProjectDetail } from "@/lib/site-builder";

type Ctx = { params: Promise<{ projectId: string }> };

export async function GET(_request: Request, context: Ctx) {
  try {
    const user = await requireUser();
    const { projectId } = await context.params;
    return jsonOk(await getSiteProjectDetail(user.id, projectId));
  } catch (error) {
    return jsonError(error);
  }
}
