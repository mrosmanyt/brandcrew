/**
 * Pure fixed-window rate-limit math, shared by the in-memory limiter
 * (per-isolate fallback) and the Postgres-backed limiter so both enforce
 * identical semantics. No imports — safe for check scripts and any runtime.
 */

export type RateWindowRow = {
  count: number;
  /** Epoch ms when the current window ends. */
  resetAt: number;
};

export type RateHit =
  | { ok: true; row: RateWindowRow }
  | { ok: false; retryAfterSec: number; row: RateWindowRow };

/**
 * Apply one hit to a fixed window.
 *
 * - No row, or `now` at/after `resetAt`: a fresh window starts at count 1.
 * - Count already at the limit: rejected, row returned unchanged so the
 *   caller does not persist a larger counter for a refused hit.
 * - Otherwise the count increments inside the same window.
 */
export function applyWindowHit(
  now: number,
  row: RateWindowRow | null,
  limit: number,
  windowMs: number,
): RateHit {
  if (!row || now >= row.resetAt) {
    return { ok: true, row: { count: 1, resetAt: now + windowMs } };
  }
  if (row.count >= limit) {
    return {
      ok: false,
      retryAfterSec: Math.max(1, Math.ceil((row.resetAt - now) / 1000)),
      row,
    };
  }
  return { ok: true, row: { count: row.count + 1, resetAt: row.resetAt } };
}
