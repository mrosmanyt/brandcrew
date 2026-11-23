-- Website builder multi-page sites (Package 11c): extra pages of a
-- SiteVersion live in their own table; the home page stays in
-- SiteVersion.html exactly as v1. Additive only — one new table.
-- NOTE (standing DIRECT_URL caveat): this migration deploys to the
-- DIRECT_URL database; the live runtime database still needs the same
-- SQL applied separately, as with previous packages.

-- CreateTable
CREATE TABLE "SitePage" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "html" TEXT NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SitePage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SitePage_versionId_path_key" ON "SitePage"("versionId", "path");

-- CreateIndex
CREATE INDEX "SitePage_versionId_sort_idx" ON "SitePage"("versionId", "sort");

-- AddForeignKey
ALTER TABLE "SitePage" ADD CONSTRAINT "SitePage_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "SiteVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
