-- Routines, session replay, action-cache recipes, live event triggers.

ALTER TABLE "ScheduledJob" ADD COLUMN "skillId" TEXT;
ALTER TABLE "ScheduledJob" ADD COLUMN "deliverSlack" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ScheduledJob" ADD COLUMN "deliverEmail" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ScheduledJob" ADD COLUMN "slackChannel" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ScheduledJob" ADD COLUMN "sourceJobId" TEXT;

ALTER TABLE "Job" ADD COLUMN "routineId" TEXT;

ALTER TABLE "ActionCache" ADD COLUMN "recipe" TEXT NOT NULL DEFAULT '{}';
ALTER TABLE "ActionCache" ADD COLUMN "playbookKey" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ActionCache" ADD COLUMN "misses" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "EventTrigger" ADD COLUMN "agentId" TEXT;
ALTER TABLE "EventTrigger" ADD COLUMN "cursor" TEXT NOT NULL DEFAULT '';
ALTER TABLE "EventTrigger" ADD COLUMN "lastFiredAt" TIMESTAMP(3);
ALTER TABLE "EventTrigger" ADD COLUMN "lastJobId" TEXT;
ALTER TABLE "EventTrigger" ALTER COLUMN "note" SET DEFAULT '';

CREATE INDEX "EventTrigger_enabled_kind_idx" ON "EventTrigger"("enabled", "kind");

CREATE TABLE "Routine" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "agentId" TEXT,
    "skillId" TEXT,
    "scheduleId" TEXT,
    "playbookKey" TEXT NOT NULL DEFAULT '',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "cadence" TEXT NOT NULL,
    "deliverSlack" BOOLEAN NOT NULL DEFAULT false,
    "deliverEmail" BOOLEAN NOT NULL DEFAULT false,
    "slackChannel" TEXT NOT NULL DEFAULT '',
    "emailTo" TEXT NOT NULL DEFAULT '',
    "sourceJobId" TEXT,
    "lastJobId" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Routine_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Routine_workspaceId_enabled_idx" ON "Routine"("workspaceId", "enabled");

ALTER TABLE "Routine" ADD CONSTRAINT "Routine_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Job" ADD CONSTRAINT "Job_routineId_fkey" FOREIGN KEY ("routineId") REFERENCES "Routine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "SessionReplay" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "packed" TEXT NOT NULL DEFAULT '{}',
    "stepCount" INTEGER NOT NULL DEFAULT 0,
    "llmCalls" INTEGER NOT NULL DEFAULT 0,
    "llmSkipped" INTEGER NOT NULL DEFAULT 0,
    "cacheHits" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionReplay_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SessionReplay_jobId_key" ON "SessionReplay"("jobId");
CREATE INDEX "SessionReplay_workspaceId_createdAt_idx" ON "SessionReplay"("workspaceId", "createdAt");

ALTER TABLE "SessionReplay" ADD CONSTRAINT "SessionReplay_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SessionReplay" ADD CONSTRAINT "SessionReplay_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
