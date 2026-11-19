-- Durable rate limiting: fixed-window counters shared across serverless
-- instances. One row per limiter key, written by a single atomic
-- INSERT … ON CONFLICT upsert in src/lib/rate-limit.ts. Additive only —
-- the in-memory limiter remains as the fallback when the DB is unreachable.

-- CreateTable
CREATE TABLE "RateLimitBucket" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "resetAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "RateLimitBucket_resetAt_idx" ON "RateLimitBucket"("resetAt");
