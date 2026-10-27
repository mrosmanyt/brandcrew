-- Google sign-in: optional password (Google-only users) + Google subject link.
-- Plugin OAuth tokens stay on PluginConnection — this is User login only.

ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;

ALTER TABLE "User" ADD COLUMN "googleId" TEXT;

CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");
