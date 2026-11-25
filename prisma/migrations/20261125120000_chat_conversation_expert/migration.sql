-- Experts gallery (Package 5): the curated expert persona active on a
-- chat conversation (id from src/lib/experts.ts). Additive only — one
-- nullable column, no foreign key (experts are curated code data).
-- NOTE (standing DIRECT_URL caveat): this migration deploys to the
-- DIRECT_URL database; the live runtime database still needs the same
-- SQL applied separately, as with previous packages.

-- AlterTable
ALTER TABLE "ChatConversation" ADD COLUMN "expertId" TEXT;
