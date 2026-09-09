-- On-device Chrome extension + native host pairing, per-job domain allowlist,
-- durable workspace audit, Phase 2 action cache + event trigger stubs.

ALTER TABLE "Job" ADD COLUMN "allowedDomains" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "Job" ADD COLUMN "runnerKind" TEXT NOT NULL DEFAULT 'auto';

CREATE TABLE "LocalDevice" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Chrome',
    "tokenHash" TEXT NOT NULL,
    "pairingCode" TEXT,
    "pairingExpiresAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "lastSeenAt" TIMESTAMP(3),
    "capabilities" TEXT NOT NULL DEFAULT '[]',
    "nativeHost" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LocalDevice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LocalDevice_tokenHash_key" ON "LocalDevice"("tokenHash");
CREATE UNIQUE INDEX "LocalDevice_pairingCode_key" ON "LocalDevice"("pairingCode");
CREATE INDEX "LocalDevice_workspaceId_status_idx" ON "LocalDevice"("workspaceId", "status");

ALTER TABLE "LocalDevice" ADD CONSTRAINT "LocalDevice_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "DeviceCommand" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "tool" TEXT NOT NULL,
    "args" TEXT NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'queued',
    "result" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeviceCommand_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DeviceCommand_deviceId_status_createdAt_idx" ON "DeviceCommand"("deviceId", "status", "createdAt");
CREATE INDEX "DeviceCommand_jobId_idx" ON "DeviceCommand"("jobId");

ALTER TABLE "DeviceCommand" ADD CONSTRAINT "DeviceCommand_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "LocalDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeviceCommand" ADD CONSTRAINT "DeviceCommand_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "WorkspaceAudit" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "jobId" TEXT,
    "deviceId" TEXT,
    "actor" TEXT NOT NULL DEFAULT 'system',
    "action" TEXT NOT NULL,
    "detail" TEXT NOT NULL DEFAULT '',
    "data" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceAudit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WorkspaceAudit_workspaceId_createdAt_idx" ON "WorkspaceAudit"("workspaceId", "createdAt");
CREATE INDEX "WorkspaceAudit_jobId_idx" ON "WorkspaceAudit"("jobId");

ALTER TABLE "WorkspaceAudit" ADD CONSTRAINT "WorkspaceAudit_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ActionCache" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "actionKey" TEXT NOT NULL,
    "selector" TEXT NOT NULL,
    "hits" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActionCache_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ActionCache_workspaceId_domain_actionKey_key" ON "ActionCache"("workspaceId", "domain", "actionKey");
CREATE INDEX "ActionCache_workspaceId_domain_idx" ON "ActionCache"("workspaceId", "domain");

ALTER TABLE "ActionCache" ADD CONSTRAINT "ActionCache_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "EventTrigger" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "playbookKey" TEXT NOT NULL DEFAULT '',
    "config" TEXT NOT NULL DEFAULT '{}',
    "note" TEXT NOT NULL DEFAULT 'Phase 2 stub',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventTrigger_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EventTrigger_workspaceId_kind_idx" ON "EventTrigger"("workspaceId", "kind");

ALTER TABLE "EventTrigger" ADD CONSTRAINT "EventTrigger_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
