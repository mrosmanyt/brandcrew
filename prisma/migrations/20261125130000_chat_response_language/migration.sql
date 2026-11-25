-- Per-user chat response language (multi-language chat, owner directive
-- 2026-11-25). Stores a ChatLanguageMode code from src/lib/chat-language.ts;
-- "auto" mirrors the user's own language. Additive only — one new column
-- with a default, existing rows keep working untouched.
-- NOTE (standing DIRECT_URL caveat): this migration deploys to the
-- DIRECT_URL database; the live runtime database still needs the same
-- SQL applied separately, as with previous packages.

ALTER TABLE "ChatUserSettings" ADD COLUMN "responseLanguage" TEXT NOT NULL DEFAULT 'auto';
