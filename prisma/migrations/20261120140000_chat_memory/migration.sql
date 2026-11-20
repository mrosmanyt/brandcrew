-- Chat memory: per-user remembered facts + custom instructions for the
-- chat product (src/lib/chat-memory.ts). Facts are written ONLY by the
-- user in the Memory panel (no silent extraction in v1) and can be viewed
-- and deleted there. Additive new tables only.

-- CreateTable
CREATE TABLE "ChatMemoryFact" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fact" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatMemoryFact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatUserSettings" (
    "userId" TEXT NOT NULL,
    "customInstructions" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatUserSettings_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE INDEX "ChatMemoryFact_userId_createdAt_idx" ON "ChatMemoryFact"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "ChatMemoryFact" ADD CONSTRAINT "ChatMemoryFact_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatUserSettings" ADD CONSTRAINT "ChatUserSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
