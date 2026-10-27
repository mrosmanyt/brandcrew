/**
 * Provider prompt caching — reuse the long system/tool prefix so repeated
 * planner and write calls do not pay full input tokens.
 *
 * Anthropic: explicit `cache_control: ephemeral` on the system block.
 * OpenAI: automatic prefix caching when the system prompt is stable (we keep
 * it byte-stable). Gemini 2.5: implicit caching on repeated prefixes.
 */

export const PROMPT_CACHE_TTL = "ephemeral" as const;

export type PromptCacheHint = {
  enabled: boolean;
  provider: "anthropic" | "openai" | "gemini" | "xai" | "none";
  note: string;
};

export function promptCacheForProvider(
  provider: "anthropic" | "openai" | "gemini" | "xai",
): PromptCacheHint {
  if (provider === "anthropic") {
    return {
      enabled: true,
      provider,
      note: "Anthropic cache_control=ephemeral on the system prompt.",
    };
  }
  if (provider === "openai") {
    return {
      enabled: true,
      provider,
      note: "OpenAI automatic prefix caching; system prompt kept stable.",
    };
  }
  if (provider === "gemini") {
    return {
      enabled: true,
      provider,
      note: "Gemini implicit caching on repeated system prefixes.",
    };
  }
  return {
    enabled: false,
    provider,
    note: "xAI has no prompt-cache API in this slice.",
  };
}

/** Anthropic Messages API system value with cache_control. */
export function anthropicCachedSystem(text: string):
  | string
  | Array<{ type: "text"; text: string; cache_control: { type: "ephemeral" } }> {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;
  return [
    {
      type: "text",
      text: trimmed,
      cache_control: { type: "ephemeral" },
    },
  ];
}
