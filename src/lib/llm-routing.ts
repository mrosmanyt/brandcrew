import {
  DISPLAY_MODEL_IDS,
  displayModelById,
  isDisplayModelId,
  type DisplayModelId,
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

const LEGACY_ROUTING: Record<string, LlmRoutingPreference> = {
  gemini: "gemini-3.8-flash",
  "gemini-flash": "gemini-3.8-flash",
  anthropic: "opus-4.8",
  openai: "gpt-astra",
  claude: "opus-4.8",
  "claude-opus": "opus-4.8",
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
): "anthropic" | "openai" | "gemini" | null {
  return displayModelById(id)?.provider ?? null;
}

export type { DisplayModelId };
