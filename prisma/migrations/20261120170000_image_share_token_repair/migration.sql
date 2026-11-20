-- Repair for 20261120160000_image_share_token: in production the public
-- share read paths (GET /share/image/<token>, GET /api/share/image/<token>/raw)
-- returned 500 for every token that reached the database, because
-- prisma.imageGenAsyncResult.findUnique({ where: { shareToken } }) throws
-- when the column is absent — while tokens rejected by the length guard in
-- src/lib/image-share.ts correctly returned 404, and other runtime queries
-- against the same database succeed. The original migration is recorded in
-- the deploy pipeline, yet its DDL is not reflected in the database the
-- share query runs against. Re-apply the exact same DDL idempotently:
-- a no-op where the column/index already exist, a repair where they do not.

-- AlterTable
ALTER TABLE "ImageGenAsyncResult" ADD COLUMN IF NOT EXISTS "shareToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ImageGenAsyncResult_shareToken_key" ON "ImageGenAsyncResult"("shareToken");
