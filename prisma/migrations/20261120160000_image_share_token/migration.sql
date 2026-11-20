-- AI Photo Studio sharing: an opt-in public share token on a generated
-- image row. Additive nullable column plus its unique index — existing
-- rows stay private (NULL token), no backfill, safe to deploy before the
-- code that reads it. Postgres treats NULLs as distinct, so the unique
-- index does not collide across unshared rows.

-- AlterTable
ALTER TABLE "ImageGenAsyncResult" ADD COLUMN "shareToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ImageGenAsyncResult_shareToken_key" ON "ImageGenAsyncResult"("shareToken");
