import { requireApiKey, V1_ENDPOINTS } from "@/lib/api-keys";
import { jsonError, jsonOk } from "@/lib/http";

export async function GET(request: Request) {
  try {
    const { workspaceId } = await requireApiKey(request);
    return jsonOk({
      workspaceId,
      endpoints: V1_ENDPOINTS,
      docs: "Keys never expose model provider secrets. Playwright is off on Vercel.",
    });
  } catch (error) {
    return jsonError(error);
  }
}
