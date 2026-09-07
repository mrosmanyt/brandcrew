export type LlmStatus = {
  openai: boolean;
  anthropic: boolean;
  gemini: boolean;
  xai: boolean;
  configured: boolean;
  mode: "live" | "demo";
};

export const LLM_ROUTING_PREFERENCES = [
  "auto",
  "gemini",
  "anthropic",
  "openai",
] as const;

export type LlmRoutingPreference = (typeof LLM_ROUTING_PREFERENCES)[number];

export function normalizeModelRouting(
  value?: string | null,
): LlmRoutingPreference {
  if (value === "gemini" || value === "anthropic" || value === "openai") {
    return value;
  }
  return "auto";
}
