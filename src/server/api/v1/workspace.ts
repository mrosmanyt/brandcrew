import { requireApiKey } from "@/lib/api-keys";
import { jsonError, jsonOk } from "@/lib/http";
import { serializeWorkspace } from "@/lib/workspace";

export async function GET(request: Request) {
  try {
    const { workspace } = await requireApiKey(request);
    return jsonOk({ workspace: serializeWorkspace(workspace) });
  } catch (error) {
    return jsonError(error);
  }
}
