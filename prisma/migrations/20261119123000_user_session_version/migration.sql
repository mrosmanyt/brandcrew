-- Session versioning: session JWTs carry the user's sessionVersion as the
-- `sv` claim and are rejected once it no longer matches. Password change
-- and sign-out-everywhere bump it, giving a global session kill for the
-- otherwise stateless 30-day tokens. Existing rows default to 0, which
-- matches pre-existing tokens (no `sv` claim reads as 0), so nobody is
-- signed out by this migration.

-- AlterTable
ALTER TABLE "User" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;
