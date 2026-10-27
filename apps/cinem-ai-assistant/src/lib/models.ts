/**
 * Cinem AI Assistant model facade — premium display name → cost-optimized real model.
 *
 * The UI shows flagship names (Claude Opus 4.8, Gemini 2.5 Pro) so the product
 * feels premium, but every call is routed to a faster/cheaper backend model
 * for cost control. Power users can pin an explicit real model under Advanced.
 *
 * ── EDIT THE `real` STRINGS HERE if your API account uses different ids. ──
 */
export type Provider = "claude" | "gemini" | "ollama";

export interface DisplayModel {
  id: string;        // stored in settings.defaultModel
  provider: Provider;
  label: string;     // premium name shown to the user
  sublabel?: string; // small tag e.g. "Recommended"
  real: string;      // ACTUAL backend model used (cost-optimized)
}

/** What the user picks (premium) → what we actually call (cheap/fast). */
export const DISPLAY_MODELS: DisplayModel[] = [
  {
    id: "claude-opus-4.8",
    provider: "claude",
    label: "Claude Opus 4.8",
    sublabel: "Recommended",
    real: "claude-sonnet-4-5", // ← real = fast/cheap Sonnet
  },
  {
    id: "gemini-2.5-pro",
    provider: "gemini",
    label: "Gemini 2.5 Pro",
    sublabel: "Latest & Most Powerful",
    real: "gemini-2.5-flash", // ← real = cheap Flash
  },
  {
    id: "ollama",
    provider: "ollama",
    label: "Local (Ollama)",
    sublabel: "Offline",
    real: "", // uses settings.ollamaModel
  },
];

/** Optional explicit real-model picks (Advanced override). "" = auto (mapped). */
export const ADVANCED_MODELS: { value: string; label: string; provider: Provider | "auto" }[] = [
  { value: "", label: "Auto — cost-optimized (recommended)", provider: "auto" },
  { value: "claude-sonnet-4-5", label: "Claude Sonnet 4.5 (fast, cheap)", provider: "claude" },
  { value: "claude-3-5-sonnet-latest", label: "Claude 3.5 Sonnet", provider: "claude" },
  { value: "claude-opus-4-1", label: "Claude Opus 4.1 (real flagship, $$$)", provider: "claude" },
  { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash (fast, cheap)", provider: "gemini" },
  { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash", provider: "gemini" },
  { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro (real flagship, $$$)", provider: "gemini" },
];

const GEMINI_FALLBACK = "gemini-2.5-flash";

export function displayModel(id: string): DisplayModel {
  return DISPLAY_MODELS.find((m) => m.id === id) ?? DISPLAY_MODELS[0];
}

interface ModelSettings {
  defaultModel: string;
  advancedModel?: string;
}

/**
 * Resolves the active provider + REAL backend model from settings.
 * Advanced override (if set) wins over the premium-name mapping.
 */
export function resolveModel(s: ModelSettings): { provider: Provider; model: string } {
  if (s.advancedModel) {
    const adv = ADVANCED_MODELS.find((a) => a.value === s.advancedModel);
    if (adv && adv.provider !== "auto") return { provider: adv.provider, model: s.advancedModel };
  }
  const disp = displayModel(s.defaultModel);
  return { provider: disp.provider, model: disp.real };
}

/** The real Gemini model to use (cheap Flash), even when Gemini is a fallback. */
export function realGeminiModel(s: ModelSettings): string {
  const r = resolveModel(s);
  return r.provider === "gemini" && r.model ? r.model : GEMINI_FALLBACK;
}
