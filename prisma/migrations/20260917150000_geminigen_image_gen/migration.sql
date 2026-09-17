-- GeminiGen BYOK + async webhook/poll cache for image jobs.
ALTER TABLE "UserProviderKey" ADD COLUMN "geminigenApiKeyEnc" TEXT NOT NULL DEFAULT '';

CREATE TABLE "ImageGenAsyncResult" (
    "uuid" TEXT NOT NULL,
    "mediaUrl" TEXT NOT NULL DEFAULT '',
    "status" INTEGER NOT NULL DEFAULT 1,
    "errorMessage" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImageGenAsyncResult_pkey" PRIMARY KEY ("uuid")
);
