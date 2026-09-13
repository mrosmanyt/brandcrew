/**
 * Cinem AI Assistant cost model — single source of truth for usage → ₹ estimation.
 * MUST stay in sync with `usage_cost_inr()` in
 * supabase/migrations/002_usage_analytics.sql.
 */

/** Gemini 2.5 Flash list price (USD per 1M tokens). */
export const GEMINI_IN_USD_PER_M = 0.3;
export const GEMINI_OUT_USD_PER_M = 2.5;
/** ElevenLabs effective rate (USD per 1k chars — Business tier $990/6M). */
export const TTS_USD_PER_1K = 0.165;
export const USD_TO_INR = 88;

/** Default "high usage" warning threshold when no soft limit is set. */
export const DEFAULT_SOFT_LIMIT_INR = 250;

export interface UsageAggregates {
  geminiIn: number;
  geminiOut: number;
  ttsChars: number;
}

/** Estimated month-to-date cost in ₹ (rounded to 2 decimals). */
export function estCostInr(u: UsageAggregates): number {
  const usd =
    (u.geminiIn * GEMINI_IN_USD_PER_M) / 1e6 +
    (u.geminiOut * GEMINI_OUT_USD_PER_M) / 1e6 +
    (u.ttsChars * TTS_USD_PER_1K) / 1e3;
  return Math.round(usd * USD_TO_INR * 100) / 100;
}

/** Pretty token/char counts: 1.2k, 3.4M. */
export function fmtQty(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
  return String(n);
}
