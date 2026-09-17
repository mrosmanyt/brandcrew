-- Optional per-user Cloudflare image worker BYOK (encrypted at rest).
ALTER TABLE "UserProviderKey" ADD COLUMN "imageGenUrlEnc" TEXT NOT NULL DEFAULT '';
ALTER TABLE "UserProviderKey" ADD COLUMN "imageGenApiKeyEnc" TEXT NOT NULL DEFAULT '';
