-- AdminAuditLog search (getAdminAudit) does `meta`/`targetId` `contains`
-- (ILIKE %q%) lookups over free-text columns. The existing createdAt/
-- actorEmail/action btree indexes don't help substring search, and this
-- table is append-only — it only grows. pg_trgm + GIN trigram indexes make
-- ILIKE '%q%' index-friendly instead of a full sequential scan.
--
-- Not represented as a Prisma `@@index` (the schema DSL doesn't have GIN
-- trigram-ops syntax without the postgresqlExtensions preview feature) —
-- this is a raw-SQL-only index, safe for `prisma migrate deploy` to apply
-- alongside the declarative schema. Requires the DB role to be able to
-- create extensions; on managed Postgres (Neon, RDS, Supabase) pg_trgm is
-- allow-listed for this by default. If the deploy role lacks CREATE
-- EXTENSION rights, run this statement once as a superuser/admin role and
-- re-run migrate deploy.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX "AdminAuditLog_meta_trgm_idx" ON "AdminAuditLog" USING GIN ("meta" gin_trgm_ops);
CREATE INDEX "AdminAuditLog_targetId_trgm_idx" ON "AdminAuditLog" USING GIN ("targetId" gin_trgm_ops);
