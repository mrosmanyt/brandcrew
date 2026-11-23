-- Website builder publishing (Package 11d): one publication row per
-- project pins a version to a free subdomain (<slug>.cinem.tech), served
-- from inside the app. Additive only — one new table, nothing existing
-- is changed or removed.
-- NOTE (standing DIRECT_URL caveat): this migration deploys to the
-- DIRECT_URL database; the live runtime database still needs the same
-- SQL applied separately before/after merge, as with previous packages.

-- CreateTable
CREATE TABLE "SitePublication" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "versionId" TEXT,
    "isLive" BOOLEAN NOT NULL DEFAULT true,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SitePublication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SitePublication_projectId_key" ON "SitePublication"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "SitePublication_slug_key" ON "SitePublication"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "SitePublication_versionId_key" ON "SitePublication"("versionId");

-- CreateIndex
CREATE INDEX "SitePublication_slug_idx" ON "SitePublication"("slug");

-- AddForeignKey
ALTER TABLE "SitePublication" ADD CONSTRAINT "SitePublication_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "SiteProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SitePublication" ADD CONSTRAINT "SitePublication_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "SiteVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
