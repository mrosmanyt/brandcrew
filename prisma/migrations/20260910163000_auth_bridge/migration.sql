-- Multi-surface auth: refresh tokens, connect tickets, account-linked devices.

ALTER TABLE "LocalDevice" ADD COLUMN "linkedUserId" TEXT;

CREATE INDEX "LocalDevice_linkedUserId_idx" ON "LocalDevice"("linkedUserId");

CREATE TABLE "AuthRefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "surface" TEXT NOT NULL,
    "deviceName" TEXT NOT NULL DEFAULT '',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthRefreshToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AuthRefreshToken_tokenHash_key" ON "AuthRefreshToken"("tokenHash");
CREATE INDEX "AuthRefreshToken_userId_revokedAt_idx" ON "AuthRefreshToken"("userId", "revokedAt");

ALTER TABLE "AuthRefreshToken" ADD CONSTRAINT "AuthRefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "AuthConnectTicket" (
    "id" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "surface" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "userId" TEXT,
    "workspaceId" TEXT,
    "deviceName" TEXT NOT NULL DEFAULT '',
    "payloadEnc" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "claimedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthConnectTicket_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AuthConnectTicket_nonce_key" ON "AuthConnectTicket"("nonce");
CREATE INDEX "AuthConnectTicket_status_expiresAt_idx" ON "AuthConnectTicket"("status", "expiresAt");
