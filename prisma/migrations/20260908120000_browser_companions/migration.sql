-- Companion allowed-tools + Prisma-backed job clarification pause.

ALTER TABLE "Agent" ADD COLUMN "allowedTools" TEXT NOT NULL DEFAULT '[]';

ALTER TABLE "Job" ADD COLUMN "askKind" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Job" ADD COLUMN "userAnswer" TEXT NOT NULL DEFAULT '';
