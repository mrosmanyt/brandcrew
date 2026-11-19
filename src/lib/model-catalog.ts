/**
 * Truthful display→backend model catalog.
 *
 * Picker names ARE the models that get called. Every picker entry resolves
 * (via `providerModelIdFor`) to exactly the provider model its name states,
 * using the provider env override the entry names. There are no marketing
 * aliases and no silent downgrades: an explicit pick is honored exactly
 * (see `routeForCatalogModel` in `src/lib/llm.ts` and chat route resolution
 * in `src/lib/chat.ts`).
 *
 * Cost control is explicit instead of hidden:
 * - The "Fast" picker group holds each provider's cheaper draft model,
 *   labelled Fast. Full models sit in "Most advanced".
 * - Auto / task routing (no explicit pick) keeps the cheap-first policy in
 *   `pickRouteDefault` — the system choosing cheaply is Auto's documented
 *   behavior, and per-plan token budgets (`assertLlmCallBudget`) still cap
 *   every call. A plan that cannot afford a picked model gets the honest
 *   budget error, never a swapped model.
 *
 * | UI (displayName)   | Catalog id         | Backend class    | Real provider id (env)     |
 * |--------------------|--------------------|------------------|----------------------------|
 * | Claude Sonnet 5    | claude-sonnet      | anthropic-final  | ANTHROPIC_FINAL_MODEL      |
 * | GPT-4.1            | gpt-4.1            | openai-final     | OPENAI_FINAL_MODEL         |
 * | Gemini 2.5 Pro     | gemini-2.5-pro     | gemini-final     | GEMINI_FINAL_MODEL         |
 * | Claude Haiku 4.5   | claude-haiku       | anthropic-draft  | ANTHROPIC_DRAFT_MODEL      |
 * | GPT-4o mini        | gpt-4o-mini        | openai-draft     | OPENAI_DRAFT_MODEL         |
 * | Gemini 2.5 Flash   | gemini-2.5-flash   | gemini-draft     | GEMINI_DRAFT_MODEL         |
 * | Grok 3 Mini        | grok-3-mini        | xai              | XAI_MODEL                  |
 *
 * Retired marketing ids are NOT catalog entries anymore. Stored
 * preferences using them coerce to the entry whose backend they actually
 * executed — see LEGACY_ROUTING in `src/lib/llm-routing.ts`.
 */

export const PICKER_GROUPS = [
  { id: "fastest", label: "Fast — quick answers, lower cost" },
  { id: "advanced", label: "Most advanced" },
] as const;

export type PickerGroupId = (typeof PICKER_GROUPS)[number]["id"];

/** @deprecated Use PICKER_GROUPS. Kept so older imports still type-check. */
export const MODEL_CAPABILITIES = PICKER_GROUPS.map((row) => row.label);
export type ModelCapability = (typeof MODEL_CAPABILITIES)[number];

export const DISPLAY_MODEL_IDS = [
  "claude-sonnet",
  "gpt-4.1",
  "gemini-2.5-pro",
  "claude-haiku",
  "gpt-4o-mini",
  "gemini-2.5-flash",
  "grok-3-mini",
] as const;

export type DisplayModelId = (typeof DISPLAY_MODEL_IDS)[number];

export type BackendClass =
  | "anthropic-draft"
  | "anthropic-final"
  | "openai-draft"
  | "openai-final"
  | "gemini-draft"
  | "gemini-final"
  | "xai";

export type ModelProvider = "anthropic" | "openai" | "gemini" | "xai";

export type DisplayModel = {
  id: DisplayModelId;
  displayName: string;
  provider: ModelProvider;
  backendClass: BackendClass;
  pickerGroup: PickerGroupId | null;
  capability: ModelCapability | null;
  providerModelEnv: string;
  defaultProviderModelId: string;
  hint: string;
};

export const ANTHROPIC_SONNET_MODEL_ID = "claude-sonnet-5";
export const ANTHROPIC_HAIKU_MODEL_ID = "claude-haiku-4-5";
export const OPENAI_FINAL_MODEL_ID = "gpt-4.1";
export const GPT_TERRA_MODEL_ID = "gpt-4o-mini";
export const GEMINI_PRO_MODEL_ID = "gemini-2.5-pro";
export const GEMINI_FLASH_MODEL_ID = "gemini-2.5-flash";
export const GROK_MODEL_ID = "grok-3-mini";

export const DISPLAY_MODELS: DisplayModel[] = [
  {
    id: "claude-sonnet",
    displayName: "Claude Sonnet 5",
    provider: "anthropic",
    backendClass: "anthropic-final",
    pickerGroup: "advanced",
    capability: "Most advanced",
    providerModelEnv: "ANTHROPIC_FINAL_MODEL",
    defaultProviderModelId: ANTHROPIC_SONNET_MODEL_ID,
    hint: "Deep reasoning, writing and code",
  },
  {
    id: "gpt-4.1",
    displayName: "GPT-4.1",
    provider: "openai",
    backendClass: "openai-final",
    pickerGroup: "advanced",
    capability: "Most advanced",
    providerModelEnv: "OPENAI_FINAL_MODEL",
    defaultProviderModelId: OPENAI_FINAL_MODEL_ID,
    hint: "Advanced drafting and structured work",
  },
  {
    id: "gemini-2.5-pro",
    displayName: "Gemini 2.5 Pro",
    provider: "gemini",
    backendClass: "gemini-final",
    pickerGroup: "advanced",
    capability: "Most advanced",
    providerModelEnv: "GEMINI_FINAL_MODEL",
    defaultProviderModelId: GEMINI_PRO_MODEL_ID,
    hint: "Long documents and research",
  },
  {
    id: "claude-haiku",
    displayName: "Claude Haiku 4.5",
    provider: "anthropic",
    backendClass: "anthropic-draft",
    pickerGroup: "fastest",
    capability: "Fast — quick answers, lower cost",
    providerModelEnv: "ANTHROPIC_DRAFT_MODEL",
    defaultProviderModelId: ANTHROPIC_HAIKU_MODEL_ID,
    hint: "Fast replies at the lowest cost",
  },
  {
    id: "gpt-4o-mini",
    displayName: "GPT-4o mini",
    provider: "openai",
    backendClass: "openai-draft",
    pickerGroup: "fastest",
    capability: "Fast — quick answers, lower cost",
    providerModelEnv: "OPENAI_DRAFT_MODEL",
    defaultProviderModelId: GPT_TERRA_MODEL_ID,
    hint: "Fast replies at the lowest cost",
  },
  {
    id: "gemini-2.5-flash",
    displayName: "Gemini 2.5 Flash",
    provider: "gemini",
    backendClass: "gemini-draft",
    pickerGroup: "fastest",
    capability: "Fast — quick answers, lower cost",
    providerModelEnv: "GEMINI_DRAFT_MODEL",
    defaultProviderModelId: GEMINI_FLASH_MODEL_ID,
    hint: "Fast research and summaries",
  },
  {
    id: "grok-3-mini",
    displayName: "Grok 3 Mini",
    provider: "xai",
    backendClass: "xai",
    pickerGroup: "fastest",
    capability: "Fast — quick answers, lower cost",
    providerModelEnv: "XAI_MODEL",
    defaultProviderModelId: GROK_MODEL_ID,
    hint: "Fast, direct answers",
  },
];

export const PICKER_MODELS = DISPLAY_MODELS.filter((row) => row.pickerGroup);

export function isDisplayModelId(value: string | null | undefined): value is DisplayModelId {
  return Boolean(value && (DISPLAY_MODEL_IDS as readonly string[]).includes(value));
}

export function displayModelById(id: string | null | undefined): DisplayModel | undefined {
  if (!id) return undefined;
  return DISPLAY_MODELS.find((row) => row.id === id);
}

export function modelsByPickerGroup(group: PickerGroupId) {
  return DISPLAY_MODELS.filter((row) => row.pickerGroup === group);
}

export function modelsByCapability(capability: ModelCapability) {
  return DISPLAY_MODELS.filter((row) => row.capability === capability);
}

/** Never send Opus, even if an env override names it. */
export function refuseOpusModel(model: string, fallback: string) {
  return /opus/i.test(model) ? fallback : model;
}

function envModel(name: string, fallback: string) {
  return process.env[name]?.trim() || fallback;
}

export function haikuModelId() {
  return refuseOpusModel(
    envModel("ANTHROPIC_DRAFT_MODEL", ANTHROPIC_HAIKU_MODEL_ID),
    ANTHROPIC_HAIKU_MODEL_ID,
  );
}

export function sonnetModelId() {
  return refuseOpusModel(
    envModel("ANTHROPIC_FINAL_MODEL", ANTHROPIC_SONNET_MODEL_ID),
    ANTHROPIC_SONNET_MODEL_ID,
  );
}

/**
 * Strongest allowed Anthropic model for the Auto Ultra / Boost route.
 * Uses ANTHROPIC_BOOST_MODEL or ANTHROPIC_FINAL_MODEL, never Opus.
 * Auto routing only — no picker entry maps here anymore.
 */
export function sonnetMaxModelId() {
  const boost = process.env.ANTHROPIC_BOOST_MODEL?.trim();
  const candidate = boost || envModel("ANTHROPIC_FINAL_MODEL", ANTHROPIC_SONNET_MODEL_ID);
  return refuseOpusModel(candidate, ANTHROPIC_SONNET_MODEL_ID);
}

export function gptTerraModelId() {
  return envModel("OPENAI_DRAFT_MODEL", GPT_TERRA_MODEL_ID);
}

export function openaiFinalModelId() {
  return envModel("OPENAI_FINAL_MODEL", OPENAI_FINAL_MODEL_ID);
}

export function geminiFlashModelId() {
  const raw = envModel("GEMINI_DRAFT_MODEL", GEMINI_FLASH_MODEL_ID);
  if (/pro/i.test(raw) && !/flash/i.test(raw)) return GEMINI_FLASH_MODEL_ID;
  return raw;
}

export function geminiProModelId() {
  const raw = envModel("GEMINI_FINAL_MODEL", GEMINI_PRO_MODEL_ID);
  if (/flash/i.test(raw)) return GEMINI_PRO_MODEL_ID;
  return raw;
}

/**
 * The one xAI model the runtime calls. XAI_POSTS_MODEL is the historical
 * override name and still wins when set; XAI_MODEL is the documented env.
 */
export function xaiModelId() {
  return (
    process.env.XAI_POSTS_MODEL?.trim() ||
    process.env.XAI_MODEL?.trim() ||
    GROK_MODEL_ID
  );
}

export function providerModelIdFor(id: DisplayModelId): string {
  const row = displayModelById(id);
  if (!row) return "";
  switch (row.backendClass) {
    case "anthropic-draft":
      return haikuModelId();
    case "anthropic-final":
      return sonnetModelId();
    case "openai-draft":
      return gptTerraModelId();
    case "openai-final":
      return openaiFinalModelId();
    case "gemini-draft":
      return geminiFlashModelId();
    case "gemini-final":
      return geminiProModelId();
    case "xai":
      return xaiModelId();
  }
}

export function catalogByProviderModelId(model?: string | null): DisplayModel | undefined {
  if (!model) return undefined;
  const id = model.toLowerCase();
  if (/grok/.test(id)) return displayModelById("grok-3-mini");
  if (/haiku/.test(id)) return displayModelById("claude-haiku");
  if (/sonnet/.test(id)) return displayModelById("claude-sonnet");
  if (/flash/.test(id)) return displayModelById("gemini-2.5-flash");
  if (/pro/.test(id) && /^gemini/.test(id)) return displayModelById("gemini-2.5-pro");
  if (/mini/.test(id) && /^gpt/.test(id)) return displayModelById("gpt-4o-mini");
  if (/^gpt/.test(id)) return displayModelById("gpt-4.1");
  return undefined;
}

/** Customer-facing label for a backend model id — the truthful picker name. */
export function publicModelLabel(model?: string | null): string {
  if (!model || model === "demo") return "Offline templates";
  if (model === "browse" || model === "tools") return "Tools";
  return catalogByProviderModelId(model)?.displayName ?? "CINEM model";
}

export function describeProviderModel(model?: string | null): {
  displayName: string;
  providerModelId: string;
} {
  const providerModelId = model || "demo";
  return {
    displayName: publicModelLabel(providerModelId),
    providerModelId,
  };
}

export const DISPLAY_TO_BACKEND_MAP = DISPLAY_MODELS.map((row) => ({
  displayName: row.displayName,
  catalogId: row.id,
  backendClass: row.backendClass,
  pickerGroup: row.pickerGroup,
  capability: row.capability,
  provider: row.provider,
  defaultProviderModelId: row.defaultProviderModelId,
}));
