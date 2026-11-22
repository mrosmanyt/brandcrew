-- Website builder (Package 11b): one project per website a user builds in
-- the chat product, plus a full version chain per project. Additive only —
-- two new tables and one nullable column on ChatConversation linking a
-- builder chat to its project. Nothing existing is changed or removed.
-- NOTE (standing DIRECT_URL caveat): this migration deploys to the
-- DIRECT_URL database; the live runtime database still needs the same SQL
-- applied separately before merge, as with previous packages.

-- CreateTable
CREATE TABLE "SiteProject" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Untitled website',
    "template" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "currentVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteVersion" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'generate',
    "html" TEXT NOT NULL,
    "instruction" TEXT NOT NULL DEFAULT '',
    "model" TEXT NOT NULL DEFAULT '',
    "provider" TEXT NOT NULL DEFAULT '',
    "tokens" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SiteVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SiteProject_userId_updatedAt_idx" ON "SiteProject"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "SiteProject_workspaceId_idx" ON "SiteProject"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "SiteProject_currentVersionId_key" ON "SiteProject"("currentVersionId");

-- CreateIndex
CREATE INDEX "SiteVersion_projectId_createdAt_idx" ON "SiteVersion"("projectId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SiteVersion_projectId_version_key" ON "SiteVersion"("projectId", "version");

-- AlterTable
ALTER TABLE "ChatConversation" ADD COLUMN "siteProjectId" TEXT;

-- CreateIndex
CREATE INDEX "ChatConversation_siteProjectId_idx" ON "ChatConversation"("siteProjectId");

-- AddForeignKey
ALTER TABLE "SiteProject" ADD CONSTRAINT "SiteProject_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteProject" ADD CONSTRAINT "SiteProject_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteProject" ADD CONSTRAINT "SiteProject_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "SiteVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteVersion" ADD CONSTRAINT "SiteVersion_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "SiteProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatConversation" ADD CONSTRAINT "ChatConversation_siteProjectId_fkey" FOREIGN KEY ("siteProjectId") REFERENCES "SiteProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
