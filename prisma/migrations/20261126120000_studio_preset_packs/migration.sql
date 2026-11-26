-- Seasonal preset packs (Package 4): admin-curated Photo Studio preset
-- packs with optional start/end date windows, edited from
-- /admin/studio-packs. Additive only — one new table.
-- NOTE (standing DIRECT_URL caveat): this migration deploys to the
-- DIRECT_URL database; the live runtime database still needs the same
-- SQL applied separately, as with previous packages.

-- CreateTable
CREATE TABLE "StudioPresetPack" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "presets" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "StudioPresetPack_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StudioPresetPack_slug_key" ON "StudioPresetPack"("slug");

-- CreateIndex
CREATE INDEX "StudioPresetPack_active_startsAt_endsAt_idx" ON "StudioPresetPack"("active", "startsAt", "endsAt");
