-- Package 8 (full connectors + actions + MCP client):
-- 1. McpServer — a chat user's own remote MCP servers. Auth headers are a
--    JSON map encrypted at rest (AES-256-GCM); "" means no headers.
--    Connection status is never stored: Connected means a live
--    initialize + tools/list succeeded at check time.
-- 2. UserProviderKey gains Higgsfield API credentials (key ID + secret,
--    each encrypted at rest). Empty = not configured.
-- Additive only.

-- CreateTable
CREATE TABLE "McpServer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "headersEnc" TEXT NOT NULL DEFAULT '',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "McpServer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "McpServer_userId_idx" ON "McpServer"("userId");

-- AddForeignKey
ALTER TABLE "McpServer" ADD CONSTRAINT "McpServer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "UserProviderKey" ADD COLUMN "higgsfieldKeyIdEnc" TEXT NOT NULL DEFAULT '';
ALTER TABLE "UserProviderKey" ADD COLUMN "higgsfieldKeySecretEnc" TEXT NOT NULL DEFAULT '';
