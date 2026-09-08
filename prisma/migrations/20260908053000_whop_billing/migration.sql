-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN "whopMembershipId" TEXT;

-- CreateTable
CREATE TABLE "ProcessedWebhook" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "externalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessedWebhook_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProcessedWebhook_externalId_idx" ON "ProcessedWebhook"("externalId");

-- CreateIndex
CREATE INDEX "Workspace_whopMembershipId_idx" ON "Workspace"("whopMembershipId");
