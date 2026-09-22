-- Anonymous conversion-funnel tracking: site visit -> WhatsApp click -> purchase request -> approved
CREATE TABLE "FunnelEvent" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "anonId" TEXT NOT NULL,
    "path" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FunnelEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FunnelEvent_kind_createdAt_idx" ON "FunnelEvent"("kind", "createdAt");
CREATE INDEX "FunnelEvent_anonId_idx" ON "FunnelEvent"("anonId");

CREATE TABLE "PurchaseRequest" (
    "id" TEXT NOT NULL,
    "anonId" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "PurchaseRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PurchaseRequest_status_createdAt_idx" ON "PurchaseRequest"("status", "createdAt");
