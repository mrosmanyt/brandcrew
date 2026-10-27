-- Standalone Cinem AI Assistant billing (separate from CINEM Pro desk plans).

CREATE TABLE "AssistantSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "whopMembershipId" TEXT,
    "currentPeriodEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssistantSubscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AssistantSubscription_userId_key" ON "AssistantSubscription"("userId");
CREATE INDEX "AssistantSubscription_status_idx" ON "AssistantSubscription"("status");

ALTER TABLE "AssistantSubscription" ADD CONSTRAINT "AssistantSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
