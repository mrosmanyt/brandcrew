-- Chat web search: assistant replies can carry the source list they were
-- grounded on ({title, url} pairs from Tavily). Additive nullable column:
-- existing rows stay valid, no backfill, safe to deploy before the code
-- that reads it.

-- AlterTable
ALTER TABLE "ChatMessage" ADD COLUMN "sources" JSONB;
