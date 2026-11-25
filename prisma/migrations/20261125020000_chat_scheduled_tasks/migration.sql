-- Chat scheduled tasks (Package 9): user-scoped scheduled AI tasks for
-- the chat product plus their run history. The desk-era ScheduledJob is
-- workspace/Agent/playbook-scoped and spawns desk Jobs, so it does not
-- fit per-user chat tasks. Additive only — two new tables.
-- NOTE (standing DIRECT_URL caveat): this migration deploys to the
-- DIRECT_URL database; the live runtime database still needs the same
-- SQL applied separately, as with previous packages.

-- CreateTable
CREATE TABLE "ChatScheduledTask" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "instruction" TEXT NOT NULL,
    "cadence" TEXT NOT NULL DEFAULT 'daily',
    "timeOfDay" TEXT NOT NULL DEFAULT '09:00',
    "dayOfWeek" INTEGER NOT NULL DEFAULT 1,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "useWebSearch" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "nextRunAt" TIMESTAMP(3) NOT NULL,
    "lastRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatScheduledTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatScheduledTaskRun" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "report" TEXT NOT NULL DEFAULT '',
    "sources" JSONB,
    "error" TEXT NOT NULL DEFAULT '',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "ChatScheduledTaskRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChatScheduledTask_userId_enabled_idx" ON "ChatScheduledTask"("userId", "enabled");

-- CreateIndex
CREATE INDEX "ChatScheduledTask_enabled_nextRunAt_idx" ON "ChatScheduledTask"("enabled", "nextRunAt");

-- CreateIndex
CREATE INDEX "ChatScheduledTaskRun_taskId_startedAt_idx" ON "ChatScheduledTaskRun"("taskId", "startedAt");

-- AddForeignKey
ALTER TABLE "ChatScheduledTask" ADD CONSTRAINT "ChatScheduledTask_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatScheduledTask" ADD CONSTRAINT "ChatScheduledTask_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatScheduledTaskRun" ADD CONSTRAINT "ChatScheduledTaskRun_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "ChatScheduledTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
