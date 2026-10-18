-- Free plan default only. Existing workspace rows keep their stored tokenBudget.
ALTER TABLE "Workspace" ALTER COLUMN "tokenBudget" SET DEFAULT 40000;
