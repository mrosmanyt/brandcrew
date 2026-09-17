-- Founding members, site counter, and per-user BYOK keys.

ALTER TABLE "User" ADD COLUMN "assistantFoundingMember" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "assistantFoundingNumber" INTEGER;
ALTER TABLE "User" ADD COLUMN "inviteCode" TEXT;
ALTER TABLE "User" ADD COLUMN "invitedByUserId" TEXT;

CREATE UNIQUE INDEX "User_inviteCode_key" ON "User"("inviteCode");
CREATE INDEX "User_assistantFoundingMember_idx" ON "User"("assistantFoundingMember");

ALTER TABLE "User" ADD COLUMN "assistantRequiresPaid" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "User" ADD CONSTRAINT "User_invitedByUserId_fkey"
  FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "SiteConfig" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "assistantFoundingSlots" INTEGER NOT NULL DEFAULT 50,
    "assistantFoundingClaimed" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteConfig_pkey" PRIMARY KEY ("id")
);

INSERT INTO "SiteConfig" ("id", "assistantFoundingSlots", "assistantFoundingClaimed", "updatedAt")
VALUES ('global', 50, 0, CURRENT_TIMESTAMP);

CREATE TABLE "UserProviderKey" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "geminiKeyEnc" TEXT NOT NULL DEFAULT '',
    "deepgramKeyEnc" TEXT NOT NULL DEFAULT '',
    "geminiTokensUsed" INTEGER NOT NULL DEFAULT 0,
    "deepgramCharsUsed" INTEGER NOT NULL DEFAULT 0,
    "spendCapUsd" DOUBLE PRECISION NOT NULL DEFAULT 25,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProviderKey_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserProviderKey_userId_key" ON "UserProviderKey"("userId");

ALTER TABLE "UserProviderKey" ADD CONSTRAINT "UserProviderKey_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
