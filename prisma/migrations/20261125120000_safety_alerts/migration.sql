-- Safety alerts (owner directive 2026-11-25): one row per chat message the
-- safety classifier refused before it reached a model. Read by the owner in
-- /admin/safety-alerts. Additive only — one new table.
-- NOTE (standing DIRECT_URL caveat): this migration deploys to the
-- DIRECT_URL database; the live runtime database still needs the same
-- SQL applied separately, as with previous packages.

-- CreateTable
CREATE TABLE "SafetyAlert" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "userEmail" TEXT,
    "guestId" TEXT,
    "category" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "signals" TEXT NOT NULL DEFAULT '',
    "excerpt" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SafetyAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SafetyAlert_status_createdAt_idx" ON "SafetyAlert"("status", "createdAt");

-- CreateIndex
CREATE INDEX "SafetyAlert_userId_idx" ON "SafetyAlert"("userId");

-- CreateIndex
CREATE INDEX "SafetyAlert_guestId_idx" ON "SafetyAlert"("guestId");

-- AddForeignKey
ALTER TABLE "SafetyAlert" ADD CONSTRAINT "SafetyAlert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
