-- Website builder SEO (Package G): optional meta title/description
-- overrides on the per-project settings row. Blank = derived from the
-- site (project title + template) at serve time. Additive only.
-- NOTE (standing DIRECT_URL caveat): this migration deploys to the
-- DIRECT_URL database; the live runtime database still needs the same
-- SQL applied separately, as with previous packages.

-- AlterTable
ALTER TABLE "SiteSettings" ADD COLUMN "metaTitle" TEXT;
ALTER TABLE "SiteSettings" ADD COLUMN "metaDescription" TEXT;
