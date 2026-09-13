-- Account-bound Cinem AI Assistant usage (chat/voice turns per UTC month).
-- Entitlements follow existing CINEM Pro plans — no new Whop product.
CREATE TABLE "ProductUsage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "product" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "used" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductUsage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductUsage_userId_product_period_key" ON "ProductUsage"("userId", "product", "period");

CREATE INDEX "ProductUsage_userId_product_idx" ON "ProductUsage"("userId", "product");

ALTER TABLE "ProductUsage" ADD CONSTRAINT "ProductUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
