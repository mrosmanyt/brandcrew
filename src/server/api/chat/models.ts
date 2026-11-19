import { requireUser } from "@/lib/auth";
import { providerConfigured } from "@/lib/chat";
import { jsonError, jsonOk } from "@/lib/http";
import { getLlmStatus } from "@/lib/llm";
import { PICKER_GROUPS, PICKER_MODELS } from "@/lib/model-catalog";

/** Model picker data: catalog display models + per-provider key status. */
export async function GET() {
  try {
    await requireUser();
    return jsonOk({
      status: getLlmStatus(),
      groups: PICKER_GROUPS.map((group) => ({ id: group.id, label: group.label })),
      models: PICKER_MODELS.map((model) => ({
        id: model.id,
        displayName: model.displayName,
        provider: model.provider,
        group: model.pickerGroup,
        hint: model.hint,
        configured: providerConfigured(model.provider),
      })),
    });
  } catch (error) {
    return jsonError(error);
  }
}
