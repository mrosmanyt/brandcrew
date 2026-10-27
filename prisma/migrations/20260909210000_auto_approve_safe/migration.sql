-- Always approved: auto-run safe click/type. High-risk writes still wait.

ALTER TABLE "Workspace" ADD COLUMN "autoApproveSafe" BOOLEAN NOT NULL DEFAULT false;
