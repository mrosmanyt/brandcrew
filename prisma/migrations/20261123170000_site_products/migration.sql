-- Website builder shop products (Package F): the owner's product list
-- as JSON on the per-project settings row —
-- [{ name, price, imageAssetId?, note? }]. Orders go to WhatsApp;
-- there is deliberately no payment gateway column anywhere.
-- NOTE (standing DIRECT_URL caveat): this migration deploys to the
-- DIRECT_URL database; the live runtime database still needs the same
-- SQL applied separately, as with previous packages.

-- AlterTable
ALTER TABLE "SiteSettings" ADD COLUMN "productsJson" TEXT;
