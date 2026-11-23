-- Website builder site language (Package E): en | ur | roman-ur | mixed
-- on the per-project settings row. Additive only — one new column with
-- a default, existing rows become English sites.
-- NOTE (standing DIRECT_URL caveat): this migration deploys to the
-- DIRECT_URL database; the live runtime database still needs the same
-- SQL applied separately, as with previous packages.

-- AlterTable
ALTER TABLE "SiteSettings" ADD COLUMN "language" TEXT NOT NULL DEFAULT 'en';
