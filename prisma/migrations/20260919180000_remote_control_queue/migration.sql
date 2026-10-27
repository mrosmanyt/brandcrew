-- WhatsApp Cloud inbound routing + desktop remote command queue
CREATE TABLE "AssistantWhatsAppLink" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "phoneE164" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssistantWhatsAppLink_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AssistantRemoteCommand" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL DEFAULT '',
    "text" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "replyText" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssistantRemoteCommand_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AssistantWhatsAppLink_userId_key" ON "AssistantWhatsAppLink"("userId");
CREATE UNIQUE INDEX "AssistantWhatsAppLink_phoneE164_key" ON "AssistantWhatsAppLink"("phoneE164");
CREATE INDEX "AssistantRemoteCommand_userId_status_idx" ON "AssistantRemoteCommand"("userId", "status");
CREATE INDEX "AssistantRemoteCommand_status_createdAt_idx" ON "AssistantRemoteCommand"("status", "createdAt");

ALTER TABLE "AssistantWhatsAppLink" ADD CONSTRAINT "AssistantWhatsAppLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssistantRemoteCommand" ADD CONSTRAINT "AssistantRemoteCommand_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
