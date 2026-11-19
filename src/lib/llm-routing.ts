import {
  DISPLAY_MODEL_IDS,
  displayModelById,
  isDisplayModelId,
  type DisplayModelId,
  type ModelProvider,
} from "@/lib/model-catalog";

export type LlmStatus = {
  openai: boolean;
  anthropic: boolean;
  gemini: boolean;
  xai: boolean;
  configured: boolean;
  mode: "live" | "demo";
};

export const LLM_ROUTING_PREFERENCES = ["auto", ...DISPLAY_MODEL_IDS] as const;

export type LlmRoutingPreference = (typeof LLM_ROUTING_PREFERENCES)[number];

/**
 * Retired ids coerce to the catalog entry whose backend they ACTUALLY
 * executed under the old display→cheap-backend map, so stored preferences
 * keep behaving the way they always ran — now under truthful names:
 * - The old "Opus" / Anthropic picks ran the Haiku draft route.
 * - The old named OpenAI picks (Astra / Sol) ran the Terra draft route.
 * - The old "Fable" / CINEM-brand picks ran the Sonnet final route.
 * - The old "Gemini Flash 3.8" ran gemini-2.5-flash.
 */
const LEGACY_ROUTING: Record<string, LlmRoutingPreference> = {
  gemini: "gemini-2.5-flash",
  "gemini-flash": "gemini-2.5-flash",
  "gemini-3.8-flash": "gemini-2.5-flash",
  anthropic: "claude-haiku",
  claude: "claude-haiku",
  "claude-opus": "claude-haiku",
  "opus-4.8": "claude-haiku",
  openai: "gpt-4o-mini",
  "gpt-astra": "gpt-4o-mini",
  "gpt-sol": "gpt-4o-mini",
  "fable-5.1": "claude-sonnet",
  "cinem-super-4.8": "claude-sonnet",
  grok: "grok-3-mini",
  xai: "grok-3-mini",
};

export function normalizeModelRouting(
  value?: string | null,
): LlmRoutingPreference {
  if (!value) return "auto";
  const raw = value.trim().toLowerCase();
  if (raw === "auto") return "auto";
  const aliased = LEGACY_ROUTING[raw] ?? raw;
  if (isDisplayModelId(aliased)) return aliased;
  return "auto";
}

export function routingProvider(
  id: LlmRoutingPreference,
): ModelProvider | null {
  return displayModelById(id)?.provider ?? null;
}

export type { DisplayModelId };
