-- AlterTable
ALTER TABLE "User" ADD COLUMN "analyticsOptIn" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "analyticsOptedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "AnalyticsEvent" (
    "id" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "kind" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "planBucket" TEXT NOT NULL DEFAULT '',
    "count" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AnalyticsEvent_day_kind_key_planBucket_key" ON "AnalyticsEvent"("day", "kind", "key", "planBucket");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_day_kind_idx" ON "AnalyticsEvent"("day", "kind");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_kind_key_idx" ON "AnalyticsEvent"("kind", "key");
