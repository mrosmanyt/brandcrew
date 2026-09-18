-- Profile fields + Supabase auth user id compatibility (UUID strings in TEXT id column).

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "language" TEXT NOT NULL DEFAULT 'en';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "preferredMode" TEXT NOT NULL DEFAULT 'desk';
