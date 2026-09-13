/**
 * Model-based billing (Blueprint Section 5): har plan = monthly credits,
 * mehnga model = zyada credits. Margin yahin protect hota hai.
 *
 * ⚠ Jab real video-gen API choose ho jaye, per-video REAL cost nikaal kar
 * ye numbers adjust karo (rule: margin ≥ 70%).
 */
export const MODEL_TIERS = {
  fast: { credits: 1, label: "Fast (Gemini Flash)" },
  mid:  { credits: 2, label: "Mid (Claude Sonnet)" },
  best: { credits: 4, label: "Best (Claude Opus)" },
};

export const PLANS = {
  starter: { price: 19,  monthlyCredits: 15,  models: ["fast"],               platforms: 1, label: "Starter" },
  pro:     { price: 39,  monthlyCredits: 60,  models: ["fast", "mid"],        platforms: 3, label: "Pro" },
  agency:  { price: 149, monthlyCredits: 400, models: ["fast", "mid", "best"],platforms: 99, label: "Agency" },
};

export function costOf(modelTier) {
  const t = MODEL_TIERS[modelTier];
  if (!t) throw Object.assign(new Error(`Unknown model tier: ${modelTier}`), { status: 400 });
  return t.credits;
}

export function planAllowsModel(plan, modelTier) {
  const p = PLANS[plan] || PLANS.starter;
  return p.models.includes(modelTier);
}
