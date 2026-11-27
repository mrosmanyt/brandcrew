-- Canvas workspace: a document/code canvas beside each chat
-- conversation, with a restorable version per change. Additive only —
-- two new tables.
-- NOTE (standing DIRECT_URL caveat): this migration deploys to the
-- DIRECT_URL database; the live runtime database still needs the same
-- SQL applied separately, as with previous packages.

-- CreateTable
CREATE TABLE "ChatCanvas" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Untitled canvas',
    "kind" TEXT NOT NULL DEFAULT 'document',
    "language" TEXT NOT NULL DEFAULT '',
    "content" TEXT NOT NULL DEFAULT '',
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatCanvas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatCanvasVersion" (
    "id" TEXT NOT NULL,
    "canvasId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'user',
    "content" TEXT NOT NULL,
    "instruction" TEXT NOT NULL DEFAULT '',
    "model" TEXT NOT NULL DEFAULT '',
    "provider" TEXT NOT NULL DEFAULT '',
    "tokens" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatCanvasVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChatCanvas_conversationId_updatedAt_idx" ON "ChatCanvas"("conversationId", "updatedAt");

-- CreateIndex
CREATE INDEX "ChatCanvas_userId_updatedAt_idx" ON "ChatCanvas"("userId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ChatCanvasVersion_canvasId_version_key" ON "ChatCanvasVersion"("canvasId", "version");

-- CreateIndex
CREATE INDEX "ChatCanvasVersion_canvasId_createdAt_idx" ON "ChatCanvasVersion"("canvasId", "createdAt");

-- AddForeignKey
ALTER TABLE "ChatCanvas" ADD CONSTRAINT "ChatCanvas_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatCanvas" ADD CONSTRAINT "ChatCanvas_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatCanvas" ADD CONSTRAINT "ChatCanvas_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ChatConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatCanvasVersion" ADD CONSTRAINT "ChatCanvasVersion_canvasId_fkey" FOREIGN KEY ("canvasId") REFERENCES "ChatCanvas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
