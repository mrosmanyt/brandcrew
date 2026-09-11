-- AlterTable
ALTER TABLE "User" ADD COLUMN "supporter" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "supporterAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "supporterTotalCents" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN "supporter" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Workspace" ADD COLUMN "supporterAt" TIMESTAMP(3);
ALTER TABLE "Workspace" ADD COLUMN "supporterTotalCents" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "BrandSupport" (
    "id" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "userId" TEXT,
    "workspaceId" TEXT,
    "email" TEXT NOT NULL DEFAULT '',
    "paymentId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "provider" TEXT NOT NULL DEFAULT 'whop',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "BrandSupport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BrandSupport_paymentId_key" ON "BrandSupport"("paymentId");

-- CreateIndex
CREATE INDEX "BrandSupport_userId_idx" ON "BrandSupport"("userId");

-- CreateIndex
CREATE INDEX "BrandSupport_workspaceId_idx" ON "BrandSupport"("workspaceId");

-- CreateIndex
CREATE INDEX "BrandSupport_status_idx" ON "BrandSupport"("status");

-- CreateIndex
CREATE INDEX "User_supporter_idx" ON "User"("supporter");

-- CreateIndex
CREATE INDEX "Workspace_supporter_idx" ON "Workspace"("supporter");

-- AddForeignKey
ALTER TABLE "BrandSupport" ADD CONSTRAINT "BrandSupport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandSupport" ADD CONSTRAINT "BrandSupport_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
