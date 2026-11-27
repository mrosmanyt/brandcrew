-- Package 3 — free daily image credits + referral image credits.
-- Additive only: two columns on User/InviteRedemption plus one small
-- daily-allowance ledger table. No existing rows are rewritten; every new
-- column defaults to 0.
-- NOTE (standing DIRECT_URL caveat): this migration deploys to the
-- DIRECT_URL database; the live runtime database still needs the same
-- SQL applied separately, as with previous packages.

-- AlterTable
ALTER TABLE "User" ADD COLUMN "bonusImageCredits" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "InviteRedemption" ADD COLUMN "inviterImageCredits" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "inviteeImageCredits" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "DailyFreeImageUse" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyFreeImageUse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DailyFreeImageUse_userId_day_key" ON "DailyFreeImageUse"("userId", "day");

-- CreateIndex
CREATE INDEX "DailyFreeImageUse_day_idx" ON "DailyFreeImageUse"("day");

-- AddForeignKey
ALTER TABLE "DailyFreeImageUse" ADD CONSTRAINT "DailyFreeImageUse_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
