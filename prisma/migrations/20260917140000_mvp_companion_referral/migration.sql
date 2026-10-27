-- Mobile companion pairing + viral invite redemption

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "referralBonusMonths" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "InviteRedemption" (
    "id" TEXT NOT NULL,
    "inviteCode" TEXT NOT NULL,
    "inviterId" TEXT NOT NULL,
    "inviteeId" TEXT NOT NULL,
    "inviterBonusMonths" INTEGER NOT NULL DEFAULT 1,
    "inviteeBonusMonths" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InviteRedemption_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "InviteRedemption_inviteeId_key" ON "InviteRedemption"("inviteeId");
CREATE INDEX IF NOT EXISTS "InviteRedemption_inviterId_idx" ON "InviteRedemption"("inviterId");
CREATE INDEX IF NOT EXISTS "InviteRedemption_inviteCode_idx" ON "InviteRedemption"("inviteCode");

ALTER TABLE "InviteRedemption" ADD CONSTRAINT "InviteRedemption_inviterId_fkey"
  FOREIGN KEY ("inviterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InviteRedemption" ADD CONSTRAINT "InviteRedemption_inviteeId_fkey"
  FOREIGN KEY ("inviteeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "MobileCompanionPair" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "pairCode" TEXT NOT NULL,
    "commandTokenHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "claimedAt" TIMESTAMP(3),
    "lastCommandAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MobileCompanionPair_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MobileCompanionPair_pairCode_key" ON "MobileCompanionPair"("pairCode");
CREATE UNIQUE INDEX IF NOT EXISTS "MobileCompanionPair_commandTokenHash_key" ON "MobileCompanionPair"("commandTokenHash");
CREATE INDEX IF NOT EXISTS "MobileCompanionPair_userId_status_idx" ON "MobileCompanionPair"("userId", "status");

ALTER TABLE "MobileCompanionPair" ADD CONSTRAINT "MobileCompanionPair_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MobileCompanionPair" ADD CONSTRAINT "MobileCompanionPair_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "MobileCompanionCommand" (
    "id" TEXT NOT NULL,
    "pairId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "payload" TEXT NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'queued',
    "result" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MobileCompanionCommand_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MobileCompanionCommand_pairId_status_idx" ON "MobileCompanionCommand"("pairId", "status");

ALTER TABLE "MobileCompanionCommand" ADD CONSTRAINT "MobileCompanionCommand_pairId_fkey"
  FOREIGN KEY ("pairId") REFERENCES "MobileCompanionPair"("id") ON DELETE CASCADE ON UPDATE CASCADE;
