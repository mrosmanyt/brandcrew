-- Chat attachments: user messages can carry photo/file attachments
-- (composer-media wire shape, base64 inline — same persistence pattern as
-- ImageGenAsyncResult.imageData). Additive nullable column: existing rows
-- stay valid, no backfill, safe to deploy before the code that reads it.

-- AlterTable
ALTER TABLE "ChatMessage" ADD COLUMN "attachments" JSONB;
