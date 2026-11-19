-- Image studio history: ImageGenAsyncResult rows gain per-user history
-- fields. Webhook/poll cache rows (GeminiGen) leave them empty; studio
-- generations record prompt/provider/model and, when the provider returns
-- no hosted URL, the base64 image payload. All additive — existing rows
-- and the webhook cache behavior are unchanged.

-- AlterTable
ALTER TABLE "ImageGenAsyncResult" ADD COLUMN "userId" TEXT;
ALTER TABLE "ImageGenAsyncResult" ADD COLUMN "prompt" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ImageGenAsyncResult" ADD COLUMN "provider" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ImageGenAsyncResult" ADD COLUMN "model" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ImageGenAsyncResult" ADD COLUMN "mimeType" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ImageGenAsyncResult" ADD COLUMN "imageData" TEXT;

-- CreateIndex
CREATE INDEX "ImageGenAsyncResult_userId_createdAt_idx" ON "ImageGenAsyncResult"("userId", "createdAt");
