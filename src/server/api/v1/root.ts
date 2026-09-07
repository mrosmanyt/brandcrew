import { V1_ENDPOINTS } from "@/lib/api-catalog";
import { requireApiKey } from "@/lib/api-keys";
import { PRODUCT_NAME } from "@/lib/constants";
import { jsonError, jsonOk } from "@/lib/http";
import { serializeWorkspace } from "@/lib/workspace";

export async function GET(request: Request) {
  try {
    const { workspace } = await requireApiKey(request);
    return jsonOk({
      product: PRODUCT_NAME,
      version: "1",
      workspace: serializeWorkspace(workspace),
      endpoints: V1_ENDPOINTS,
      auth: "Authorization: Bearer cinem_live_…",
      notes: [
        "Keys are workspace-scoped. Hashes are stored — the secret is shown once at create.",
        "Jobs use the same runtime as Mission Control. Slack/Gmail send still waits for desk approval.",
        "Default agent name is New Agent.",
      ],
    });
  } catch (error) {
    return jsonError(error);
  }
}
