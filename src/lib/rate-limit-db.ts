/**
 * Postgres-backed fixed-window rate limiter (the `RateLimitBucket`
 * table). Kept in its own module so `rate-limit.ts` stays prisma-free
 * for pure check scripts; `takeTokenShared` there loads this lazily and
 * falls back to the in-memory limiter if anything here fails.
 */
import { prisma } from "@/lib/db";

type SharedHitRow = { count: number; resetAt: Date };

let lastPruneMs = 0;
const PRUNE_INTERVAL_MS = 5 * 60 * 1000;

/** Delete expired bucket rows at most once per interval per isolate. */
function pruneExpiredBuckets(now: number) {
  if (now - lastPruneMs < PRUNE_INTERVAL_MS) return;
  lastPruneMs = now;
  void prisma.rateLimitBucket
    .deleteMany({ where: { resetAt: { lt: new Date(now) } } })
    .catch(() => {
      // Best-effort hygiene; a failed prune must never affect limiting.
    });
}

/**
 * One atomic INSERT … ON CONFLICT upsert per hit — the hot path is a
 * single indexed round trip. Concurrent requests serialize on the row,
 * an expired window restarts at count 1, and `resetAt` never moves
 * inside a window, so allow/deny decisions and `retryAfterSec` match
 * the in-memory limiter exactly. (One cosmetic difference: refused hits
 * still increment the stored counter; the window end — and therefore
 * every decision — is unchanged.)
 *
 * Throws on any store failure; the caller (`takeTokenShared`) catches
 * and falls back to the per-isolate in-memory limiter.
 */
export async function takeTokenSharedDb(
  key: string,
  limit: number,
  windowMs: number,
): Promise<{ ok: true } | { ok: false; retryAfterSec: number }> {
  const now = Date.now();
  const nowDate = new Date(now);
  const rows = await prisma.$queryRaw<SharedHitRow[]>`
    INSERT INTO "RateLimitBucket" ("key", "count", "resetAt", "updatedAt")
    VALUES (${key}, 1, ${new Date(now + windowMs)}, ${nowDate})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "RateLimitBucket"."resetAt" <= ${nowDate} THEN 1
        ELSE "RateLimitBucket"."count" + 1
      END,
      "resetAt" = CASE
        WHEN "RateLimitBucket"."resetAt" <= ${nowDate} THEN ${new Date(now + windowMs)}
        ELSE "RateLimitBucket"."resetAt"
      END,
      "updatedAt" = ${nowDate}
    RETURNING "count", "resetAt"
  `;
  const row = rows[0];
  if (!row) throw new Error("rate-limit upsert returned no row");
  pruneExpiredBuckets(now);
  if (row.count > limit) {
    return {
      ok: false,
      retryAfterSec: Math.max(
        1,
        Math.ceil((row.resetAt.getTime() - now) / 1000),
      ),
    };
  }
  return { ok: true };
}
