-- Opt-in desktop crash reports (self-hosted, no third-party subprocessor)
CREATE TABLE "CrashReport" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "platform" TEXT NOT NULL,
    "appVersion" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "detail" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrashReport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CrashReport_createdAt_idx" ON "CrashReport"("createdAt");

ALTER TABLE "CrashReport" ADD CONSTRAINT "CrashReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
