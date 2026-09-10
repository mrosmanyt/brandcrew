-- Phase 3: client-wise workspaces + learning memory (per Brand Kit / approvals).

ALTER TABLE "Workspace" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'agency';
ALTER TABLE "Workspace" ADD COLUMN "clientName" TEXT NOT NULL DEFAULT '';

CREATE TABLE "WorkspaceMemory" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "value" TEXT NOT NULL,
    "approved" BOOLEAN NOT NULL DEFAULT true,
    "artifactId" TEXT,
    "jobId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceMemory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WorkspaceMemory_workspaceId_kind_idx" ON "WorkspaceMemory"("workspaceId", "kind");
CREATE INDEX "WorkspaceMemory_workspaceId_createdAt_idx" ON "WorkspaceMemory"("workspaceId", "createdAt");

ALTER TABLE "WorkspaceMemory" ADD CONSTRAINT "WorkspaceMemory_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
