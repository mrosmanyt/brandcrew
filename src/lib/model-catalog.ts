/**
 * Single display→backend model catalog.
 *
 * Desk picker shows `displayName` only. Job runtime always calls the cheap
 * `providerModelId` so Starter ($20) budgets last. Never call Opus.
 *
 * | UI (displayName)   | Catalog id         | Backend class | Real provider id          |
 * |--------------------|--------------------|---------------|---------------------------|
 * | Opus 4.8           | opus-4.8           | Haiku         | ANTHROPIC_DRAFT_MODEL     |
 * | Fable 5.1          | fable-5.1          | Sonnet        | ANTHROPIC_FINAL_MODEL     |
 * | GPT Astra          | gpt-astra          | GPT Terra     | OPENAI_DRAFT_MODEL        |
 * | Gemini 3.8 Flash   | gemini-3.8-flash   | Gemini Flash  | GEMINI_DRAFT_MODEL        |
 *
 * GPT Terra (cheap OpenAI) defaults to `gpt-4o-mini`.
 * Gemini Flash defaults to `gemini-2.5-flash` (maps the “3.1 Flash” class).
 */

export const DISPLAY_MODEL_IDS = [
  "opus-4.8",
  "fable-5.1",
  "gpt-astra",
  "gemini-3.8-flash",
] as const;

export type DisplayModelId = (typeof DISPLAY_MODEL_IDS)[number];

export type BackendClass = "haiku" | "sonnet" | "terra" | "flash";

export type DisplayModel = {
  id: DisplayModelId;
  displayName: string;
  provider: "anthropic" | "openai" | "gemini";
  backendClass: BackendClass;
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
    id: "opus-4.8",
    displayName: "Opus 4.8",
    provider: "anthropic",
    backendClass: "haiku",
    providerModelEnv: "ANTHROPIC_DRAFT_MODEL",
    defaultProviderModelId: ANTHROPIC_HAIKU_MODEL_ID,
    hint: "Fast replies and structured tools",
  },
  {
    id: "fable-5.1",
    displayName: "Fable 5.1",
    provider: "anthropic",
    backendClass: "sonnet",
    providerModelEnv: "ANTHROPIC_FINAL_MODEL",
    defaultProviderModelId: ANTHROPIC_SONNET_MODEL_ID,
    hint: "Code and complex apps",
  },
  {
    id: "gpt-astra",
    displayName: "GPT Astra",
    provider: "openai",
    backendClass: "terra",
    providerModelEnv: "OPENAI_DRAFT_MODEL",
    defaultProviderModelId: GPT_TERRA_MODEL_ID,
    hint: "OpenAI drafting",
  },
  {
    id: "gemini-3.8-flash",
    displayName: "Gemini 3.8 Flash",
    provider: "gemini",
    backendClass: "flash",
    providerModelEnv: "GEMINI_DRAFT_MODEL",
    defaultProviderModelId: GEMINI_FLASH_MODEL_ID,
    hint: "Research, outreach, and summaries",
  },
];

export function isDisplayModelId(value: string | null | undefined): value is DisplayModelId {
  return Boolean(value && (DISPLAY_MODEL_IDS as readonly string[]).includes(value));
}

export function displayModelById(id: string | null | undefined): DisplayModel | undefined {
  if (!id) return undefined;
  return DISPLAY_MODELS.find((row) => row.id === id);
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
 * Strongest allowed Anthropic model for Ultra / Boost.
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
  if (id === "opus-4.8") return haikuModelId();
  if (id === "fable-5.1") return sonnetModelId();
  if (id === "gpt-astra") return gptTerraModelId();
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
  if (!model || model === "demo") return "Offline demo";
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
  provider: row.provider,
  defaultProviderModelId: row.defaultProviderModelId,
}));
