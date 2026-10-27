/**
 * Single display→backend model catalog.
 *
 * Desk picker shows `displayName` only. Runtime still calls the cheap
 * `providerModelId` so Free / Pro ($20, internal starter id) budgets last.
 * Never call Opus. Cinem super 4.8 is a CINEM brand — it maps to the
 * strongest paid route already in use (Sonnet max), never a fake provider.
 *
 * | UI (displayName)   | Catalog id         | Backend class | Real provider id          |
 * |--------------------|--------------------|---------------|---------------------------|
 * | GPT 4.0 mini       | gpt-4o-mini        | Terra         | OPENAI_DRAFT_MODEL        |
 * | GPT Sol            | gpt-sol            | Terra         | OPENAI_DRAFT_MODEL        |
 * | GPT Astra          | gpt-astra          | Terra         | OPENAI_DRAFT_MODEL        |
 * | Gemini Flash 3.8   | gemini-3.8-flash   | Flash         | GEMINI_DRAFT_MODEL        |
 * | Claude Haiku       | claude-haiku       | Haiku         | ANTHROPIC_DRAFT_MODEL     |
 * | Claude Sonnet 5    | claude-sonnet      | Sonnet        | ANTHROPIC_FINAL_MODEL     |
 * | Fable 5.1          | fable-5.1          | Sonnet        | ANTHROPIC_FINAL_MODEL     |
 * | Opus 4.8           | opus-4.8           | Haiku         | ANTHROPIC_DRAFT_MODEL     |
 * | Cinem super 4.8    | cinem-super-4.8    | Sonnet max    | ANTHROPIC_BOOST/FINAL     |
 *
 * GPT Terra (cheap OpenAI) defaults to `gpt-4o-mini`.
 * Gemini Flash defaults to `gemini-2.5-flash` (maps the “3.1 Flash” class).
 * Free + Pro (internal starter id) Auto routing never calls Sonnet — see `planForcesCheapBackends`.
 *
 * Off-menu aliases: claude-opus → opus-4.8, gemini-flash → gemini-3.8-flash.
 * Claude Haiku stays for routing fallbacks and is hidden from the picker.
 */

export const PICKER_GROUPS = [
  { id: "fastest", label: "Fastest and quick answer" },
  { id: "complex", label: "For complex" },
  { id: "advanced", label: "Most advanced" },
] as const;

export type PickerGroupId = (typeof PICKER_GROUPS)[number]["id"];

/** @deprecated Use PICKER_GROUPS. Kept so older imports still type-check. */
export const MODEL_CAPABILITIES = PICKER_GROUPS.map((row) => row.label);
export type ModelCapability = (typeof MODEL_CAPABILITIES)[number];

export const DISPLAY_MODEL_IDS = [
  "gpt-4o-mini",
  "gpt-sol",
  "gpt-astra",
  "gemini-3.8-flash",
  "claude-haiku",
  "claude-sonnet",
  "fable-5.1",
  "opus-4.8",
  "cinem-super-4.8",
] as const;

export type DisplayModelId = (typeof DISPLAY_MODEL_IDS)[number];

export type BackendClass = "haiku" | "sonnet" | "sonnet-max" | "terra" | "flash";

export type DisplayModel = {
  id: DisplayModelId;
  displayName: string;
  provider: "anthropic" | "openai" | "gemini";
  backendClass: BackendClass;
  pickerGroup: PickerGroupId | null;
  capability: ModelCapability | null;
  providerModelEnv: string;
  defaultProviderModelId: string;
  hint: string;
};

export const GPT_TERRA_MODEL_ID = "gpt-4o-mini";
export const GEMINI_FLASH_MODEL_ID = "gemini-2.5-flash";
export const ANTHROPIC_HAIKU_MODEL_ID = "claude-haiku-4-5";
export const ANTHROPIC_SONNET_MODEL_ID = "claude-sonnet-5";

export const DISPLAY_MODELS: DisplayModel[] = [
  {
    id: "claude-sonnet",
    displayName: "Claude Sonnet 5",
    provider: "anthropic",
    backendClass: "sonnet",
    pickerGroup: "fastest",
    capability: "Fastest and quick answer",
    providerModelEnv: "ANTHROPIC_FINAL_MODEL",
    defaultProviderModelId: ANTHROPIC_SONNET_MODEL_ID,
    hint: "Fast replies and everyday work",
  },
  {
    id: "gpt-4o-mini",
    displayName: "GPT 4.0 mini",
    provider: "openai",
    backendClass: "terra",
    pickerGroup: "fastest",
    capability: "Fastest and quick answer",
    providerModelEnv: "OPENAI_DRAFT_MODEL",
    defaultProviderModelId: GPT_TERRA_MODEL_ID,
    hint: "Fastest cheap answers",
  },
  {
    id: "opus-4.8",
    displayName: "Opus 4.8",
    provider: "anthropic",
    backendClass: "haiku",
    pickerGroup: "complex",
    capability: "For complex",
    providerModelEnv: "ANTHROPIC_DRAFT_MODEL",
    defaultProviderModelId: ANTHROPIC_HAIKU_MODEL_ID,
    hint: "Complex reasoning",
  },
  {
    id: "gpt-sol",
    displayName: "GPT Sol",
    provider: "openai",
    backendClass: "terra",
    pickerGroup: "complex",
    capability: "For complex",
    providerModelEnv: "OPENAI_DRAFT_MODEL",
    defaultProviderModelId: GPT_TERRA_MODEL_ID,
    hint: "Structured drafts",
  },
  {
    id: "gemini-3.8-flash",
    displayName: "Gemini Flash 3.8",
    provider: "gemini",
    backendClass: "flash",
    pickerGroup: "complex",
    capability: "For complex",
    providerModelEnv: "GEMINI_DRAFT_MODEL",
    defaultProviderModelId: GEMINI_FLASH_MODEL_ID,
    hint: "Research and summaries",
  },
  {
    id: "gpt-astra",
    displayName: "GPT Astra",
    provider: "openai",
    backendClass: "terra",
    pickerGroup: "advanced",
    capability: "Most advanced",
    providerModelEnv: "OPENAI_DRAFT_MODEL",
    defaultProviderModelId: GPT_TERRA_MODEL_ID,
    hint: "Advanced drafting",
  },
  {
    id: "fable-5.1",
    displayName: "Fable 5.1",
    provider: "anthropic",
    backendClass: "sonnet",
    pickerGroup: "advanced",
    capability: "Most advanced",
    providerModelEnv: "ANTHROPIC_FINAL_MODEL",
    defaultProviderModelId: ANTHROPIC_SONNET_MODEL_ID,
    hint: "Code and complex apps",
  },
  {
    id: "cinem-super-4.8",
    displayName: "Cinem super 4.8",
    provider: "anthropic",
    backendClass: "sonnet-max",
    pickerGroup: "advanced",
    capability: "Most advanced",
    providerModelEnv: "ANTHROPIC_BOOST_MODEL",
    defaultProviderModelId: ANTHROPIC_SONNET_MODEL_ID,
    hint: "CINEM's strongest route",
  },
  {
    id: "claude-haiku",
    displayName: "Claude Haiku",
    provider: "anthropic",
    backendClass: "haiku",
    pickerGroup: null,
    capability: null,
    providerModelEnv: "ANTHROPIC_DRAFT_MODEL",
    defaultProviderModelId: ANTHROPIC_HAIKU_MODEL_ID,
    hint: "Routing fallback",
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
 * Strongest allowed Anthropic model for Ultra / Boost / Cinem super 4.8.
 * Uses ANTHROPIC_BOOST_MODEL or ANTHROPIC_FINAL_MODEL, never Opus.
 */
export function sonnetMaxModelId() {
  const boost = process.env.ANTHROPIC_BOOST_MODEL?.trim();
  const candidate = boost || envModel("ANTHROPIC_FINAL_MODEL", ANTHROPIC_SONNET_MODEL_ID);
  return refuseOpusModel(candidate, ANTHROPIC_SONNET_MODEL_ID);
}

export function gptTerraModelId() {
  return envModel("OPENAI_DRAFT_MODEL", GPT_TERRA_MODEL_ID);
}

export function geminiFlashModelId() {
  const raw = envModel("GEMINI_DRAFT_MODEL", GEMINI_FLASH_MODEL_ID);
  if (/pro/i.test(raw) && !/flash/i.test(raw)) return GEMINI_FLASH_MODEL_ID;
  return raw;
}

export function providerModelIdFor(id: DisplayModelId): string {
  const row = displayModelById(id);
  if (row?.backendClass === "haiku") return haikuModelId();
  if (row?.backendClass === "sonnet") return sonnetModelId();
  if (row?.backendClass === "sonnet-max") return sonnetMaxModelId();
  if (row?.backendClass === "terra") return gptTerraModelId();
  return geminiFlashModelId();
}

export function catalogByProviderModelId(model?: string | null): DisplayModel | undefined {
  if (!model) return undefined;
  const id = model.toLowerCase();
  if (/haiku/.test(id)) return displayModelById("opus-4.8");
  if (/sonnet/.test(id)) return displayModelById("fable-5.1");
  if (/opus/.test(id)) return displayModelById("opus-4.8");
  if (/flash/.test(id) || /^gemini-2/.test(id) || /^gemini-3/.test(id)) {
    return displayModelById("gemini-3.8-flash");
  }
  if (/gpt-4o-mini|gpt-4\.1-mini|gpt-4o/.test(id) || /^gpt-/.test(id)) {
    return displayModelById("gpt-astra");
  }
  return undefined;
}

/** Customer-facing label. Never a raw provider id. */
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
