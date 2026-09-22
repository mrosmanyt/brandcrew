/**
 * Internal Admin HQ: email allow-list, 403 authz, section payloads.
 * Prisma section smokes skipped if Postgres is down.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  ADMIN_SECTIONS,
  DEFAULT_ADMIN_EMAIL,
  DEFAULT_ADMIN_EMAILS,
  FOUNDER_ADMIN_EMAIL,
  getAdminAccess,
  getAdminBilling,
  getAdminCustomers,
  getAdminDashboard,
  getAdminFlags,
  getAdminModelCatalog,
  getAdminModels,
  getAdminTrust,
  getProviderKeysPresent,
  isAdminEmail,
  maskAdminEmail,
  parseAdminEmails,
  parseAdminSection,
  sanitizeFlagKey,
} from "../src/lib/admin";
import {
  BACKUP_KIND,
  isSecretFieldName,
  redactSecrets,
  REDACTED,
} from "../src/lib/admin-backup";
import { AuthError, ForbiddenError } from "../src/lib/auth";
import { prisma } from "../src/lib/db";
import { jsonError } from "../src/lib/http";

async function main() {
  assert.deepEqual(parseAdminEmails(""), [...DEFAULT_ADMIN_EMAILS]);
  assert.deepEqual(parseAdminEmails(undefined), [...DEFAULT_ADMIN_EMAILS]);
  assert.ok(parseAdminEmails("ada@cinem.tech").includes(DEFAULT_ADMIN_EMAIL));
  assert.ok(parseAdminEmails("ada@cinem.tech").includes(FOUNDER_ADMIN_EMAIL));
  assert.ok(parseAdminEmails("ada@cinem.tech").includes("ada@cinem.tech"));
  assert.equal(parseAdminEmails("Ada@cinem.tech, ada@cinem.tech").length, 3);
  console.log("ok: ADMIN_EMAILS always includes cinemtech@gmail.com and mrosmanyt@gmail.com");

  const saved = process.env.ADMIN_EMAILS;
  delete process.env.ADMIN_EMAILS;
  assert.equal(isAdminEmail("cinemtech@gmail.com"), true);
  assert.equal(isAdminEmail("CINEMTECH@gmail.com"), true);
  assert.equal(isAdminEmail("mrosmanyt@gmail.com"), true);
  assert.equal(isAdminEmail("MROSMANYT@gmail.com"), true);
  assert.equal(isAdminEmail("user@example.com"), false);
  assert.equal(isAdminEmail("qa.cinem.pro.20260907@example.com"), false);
  process.env.ADMIN_EMAILS = "ops@cinem.tech";
  assert.equal(isAdminEmail("ops@cinem.tech"), true);
  assert.equal(isAdminEmail("cinemtech@gmail.com"), true);
  assert.equal(isAdminEmail("mrosmanyt@gmail.com"), true);
  assert.equal(isAdminEmail("stranger@example.com"), false);
  assert.equal(isAdminEmail("qa.cinem.pro.20260907@example.com"), false);
  process.env.ADMIN_EMAILS = "ops@cinem.tech, qa.cinem.pro.20260907@example.com";
  assert.equal(isAdminEmail("qa.cinem.pro.20260907@example.com"), true);
  if (saved) process.env.ADMIN_EMAILS = saved;
  else delete process.env.ADMIN_EMAILS;
  console.log("ok: non-admins are not in the allow-list; QA email is env-only");

  assert.equal(maskAdminEmail("cinemtech@gmail.com"), `${"*".repeat("cinemtech".length)}@gmail.com`);
  assert.equal(maskAdminEmail("Ada@cinem.tech"), "***@cinem.tech");
  assert.match(maskAdminEmail("ops@cinem.tech"), /@cinem\.tech$/);
  assert.equal(maskAdminEmail("ops@cinem.tech").includes("ops"), false);
  console.log("ok: admin emails mask the local part and keep the domain");

  assert.equal(parseAdminSection(null), "overview");
  assert.equal(parseAdminSection("customers"), "customers");
  assert.equal(parseAdminSection("nope"), "overview");
  assert.deepEqual([...ADMIN_SECTIONS], [
    "overview",
    "customers",
    "billing",
    "models",
    "access",
    "audit",
    "trust",
    "flags",
    "crashreports",
    "funnel",
  ]);
  assert.equal(sanitizeFlagKey(" Jobs_Kill.Switch "), "jobs_kill.switch");
  assert.equal(sanitizeFlagKey("$$$"), "");
  console.log("ok: section + flag key parsers");

  const access = getAdminAccess();
  assert.equal(access.section, "access");
  assert.equal(access.role, "superadmin");
  assert.equal(access.source, "ADMIN_EMAILS");
  assert.equal(access.sso.status, "not_wired");
  assert.ok(access.emails.filter((row) => row.isDefault && row.domain === "gmail.com").length >= 2);
  assert.equal(JSON.stringify(access.emails).includes("cinemtech@"), false);
  assert.equal(JSON.stringify(access.emails).includes("mrosmanyt@"), false);
  assert.match(access.note, /Vercel/);
  assert.match(access.note, /mrosmanyt@gmail.com/);
  console.log("ok: access section lists masked emails and documents ADMIN_EMAILS");

  const catalog = getAdminModelCatalog();
  assert.ok(catalog.some((row) => row.displayName === "Opus 4.8"));
  assert.ok(catalog.every((row) => row.configuredProviderModelId.length > 0));

  const secret = "sk-admin-test-never-return-this";
  const savedOpenAi = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = secret;
  const keys = getProviderKeysPresent();
  assert.equal(keys.openai, true);
  assert.equal(typeof keys.anthropic, "boolean");
  assert.equal(typeof keys.gemini, "boolean");
  assert.equal(typeof keys.xai, "boolean");
  const leaked = JSON.stringify(keys);
  assert.equal(leaked.includes(secret), false);
  assert.equal(leaked.includes("sk-"), false);
  if (savedOpenAi === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = savedOpenAi;
  console.log("ok: model catalog + provider keys are booleans only");

  const forbidden = jsonError(new ForbiddenError("Admin access only."));
  assert.equal(forbidden.status, 403);
  const body = (await forbidden.json()) as { code?: string; error?: string };
  assert.equal(body.code, "forbidden");
  assert.match(String(body.error), /admin/i);
  const unauth = jsonError(new AuthError("Sign in to continue."));
  assert.equal(unauth.status, 401);
  const unauthBody = (await unauth.json()) as { code?: string };
  assert.equal(unauthBody.code, "unauthorized");
  console.log("ok: unauthenticated admin API is 401; non-staff is HTTP 403");

  const secretFixture = {
    users: [
      {
        email: "ada@example.com",
        passwordHash: "$2b$10$not-a-real-hash",
        googleId: "google-sub-123",
        hasPassword: true,
        tokenUsed: 12,
        tokenBudget: 15000,
      },
    ],
    plugin: { secretEnc: "enc-blob", metadata: { api_key: "sk-admin-test-never-return-this" } },
    webhookSecret: "ws_should_not_export",
    raw: "sk-live-should-redact",
  };
  const redacted = redactSecrets(secretFixture) as typeof secretFixture;
  assert.equal(redacted.users[0].passwordHash, REDACTED);
  assert.equal(redacted.users[0].googleId, REDACTED);
  assert.equal(redacted.users[0].hasPassword, true);
  assert.equal(redacted.users[0].tokenUsed, 12);
  assert.equal(redacted.plugin.secretEnc, REDACTED);
  assert.equal(redacted.plugin.metadata.api_key, REDACTED);
  assert.equal(redacted.webhookSecret, REDACTED);
  assert.equal(redacted.raw, REDACTED);
  assert.equal(isSecretFieldName("passwordHash"), true);
  assert.equal(isSecretFieldName("tokenUsed"), false);
  assert.equal(isSecretFieldName("hasPassword"), false);
  assert.equal(BACKUP_KIND, "cinem_pro_admin_backup");
  const backupLeaked = JSON.stringify(redacted);
  assert.equal(backupLeaked.includes("$2b$"), false);
  assert.equal(backupLeaked.includes("sk-admin-test"), false);
  assert.equal(backupLeaked.includes("sk-live"), false);
  assert.equal(backupLeaked.includes("google-sub-123"), false);
  console.log("ok: backup redaction strips hashes, OAuth ids, and key-shaped strings");

  const adminApi = readFileSync("src/server/api/admin/root.ts", "utf8");
  assert.ok([...adminApi.matchAll(/await requireAdmin\(\)/g)].length >= 2);
  const backupApi = readFileSync("src/server/api/admin/backup.ts", "utf8");
  assert.match(backupApi, /await requireAdmin\(\)/);
  assert.match(backupApi, /buildAdminBackup/);
  assert.match(backupApi, /Content-Disposition/);
  const helpdeskAdmin = readFileSync("src/server/api/admin/support.ts", "utf8");
  assert.ok([...helpdeskAdmin.matchAll(/await requireAdmin\(\)/g)].length >= 2);
  const helpdeskThreadAdmin = readFileSync("src/server/api/admin/support-thread.ts", "utf8");
  assert.ok([...helpdeskThreadAdmin.matchAll(/await requireAdmin\(\)/g)].length >= 2);
  const router = readFileSync("src/server/api/router.ts", "utf8");
  assert.match(router, /\["api", "admin", "backup"\]/);
  assert.match(router, /\["api", "admin", "support"\]/);
  function walkPages(dir: string, acc: string[] = []): string[] {
    for (const name of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, name.name);
      if (name.isDirectory()) walkPages(full, acc);
      else if (name.name === "page.tsx") acc.push(full);
    }
    return acc;
  }
  for (const page of walkPages("src/app/admin")) {
    const src = readFileSync(page, "utf8");
    assert.match(src, /loadAdminPage/, page);
    assert.doesNotMatch(src, /if \(!allowed\)/, `${page} must not render after a failed gate`);
    assert.doesNotMatch(src, /AdminForbidden/, `${page} must not 200 a forbidden UI`);
  }
  const adminPageGate = readFileSync("src/lib/admin-page.ts", "utf8");
  assert.match(adminPageGate, /forbidden\(\)/);
  assert.match(adminPageGate, /isAdminEmail/);
  const adminLayout = readFileSync("src/app/admin/layout.tsx", "utf8");
  assert.match(adminLayout, /forbidden\(\)/);
  assert.match(adminLayout, /isAdminEmail/);
  const settingsHub = readFileSync("src/components/desk/settings-hub.tsx", "utf8");
  assert.match(settingsHub, /user\.isAdmin === true/);
  const opsDoc = readFileSync("docs/admin-ops.md", "utf8");
  assert.match(opsDoc, /ADMIN_EMAILS/);
  assert.match(opsDoc, /mrosmanyt@gmail.com/);
  assert.match(opsDoc, /\/api\/admin\/backup/);
  assert.match(opsDoc, /SupportThread|helpdesk|Help widget/);
  assert.match(opsDoc, /Point-in-time copy|not a restore|Live truth/i);
  assert.match(opsDoc, /app\.cinem\.tech/);
  assert.match(opsDoc, /forbidden\(\)/);
  const assistantQueriesApi = readFileSync("src/server/api/admin/assistant-queries.ts", "utf8");
  assert.match(assistantQueriesApi, /assistantRegistrationAdminConfigured/);
  assert.match(assistantQueriesApi, /service_unconfigured/);
  const assistantQueriesUi = readFileSync("src/components/admin/admin-assistant-queries.tsx", "utf8");
  assert.match(assistantQueriesUi, /readJson/);
  assert.match(assistantQueriesUi, /effectiveConfigured/);
  assert.ok(existsSync("src/app/admin/assistant-queries/page.tsx"));
  assert.ok(existsSync("src/app/desk/error.tsx"));
  assert.ok(existsSync("src/app/global-error.tsx"));
  console.log("ok: assistant-queries admin hardened + desk recoverable errors");
  console.log("ok: every /admin page and /api/admin method is server-gated");
  console.log("ok: docs/admin-ops.md covers allow-list and local backup copy");

  await smokeSections();
  console.log("Admin authz checks passed.");
}

async function smokeSections() {
  try {
    const overview = await getAdminDashboard();
    assert.equal(overview.section, "overview");
    assert.equal(typeof overview.users.total, "number");
    assert.equal(typeof overview.workspaces.paid, "number");
    assert.equal(typeof overview.jobs.failedLast24h, "number");
    assert.equal(typeof overview.jobs.createdLast24h, "number");
    assert.equal(typeof overview.usage.tokensUsedThisCycle, "number");
    assert.equal(typeof overview.usage.chatTokenUsed, "number");
    assert.ok(Array.isArray(overview.failedJobs));
    assert.ok(Array.isArray(overview.approvals));
    assert.equal(typeof overview.billing.supportPaid, "number");
    assert.equal(typeof overview.billing.webhooksLast7d, "number");
    assert.equal(typeof overview.helpdesk.open, "number");
    assert.equal(typeof overview.helpdesk.live, "number");

    const customers = await getAdminCustomers({ q: "nobody-at-cinem.invalid" });
    assert.equal(customers.section, "customers");
    assert.ok(Array.isArray(customers.results));

    const listed = await getAdminCustomers({});
    assert.ok(Array.isArray(listed.results));

    const billing = await getAdminBilling();
    assert.equal(billing.section, "billing");
    assert.equal(billing.credits, null);
    assert.ok(Array.isArray(billing.paid));
    assert.ok(Array.isArray(billing.supports));
    assert.ok(Array.isArray(billing.webhooks));

    const models = await getAdminModels();
    assert.equal(models.section, "models");
    assert.equal(typeof models.keysPresent.openai, "boolean");
    assert.ok(Array.isArray(models.usageByProviderModelId));
    assert.equal(JSON.stringify(models.keysPresent).includes("sk-"), false);

    const flags = await getAdminFlags();
    assert.equal(flags.section, "flags");
    assert.ok(Array.isArray(flags.flags));

    const trust = await getAdminTrust({ q: "" });
    assert.equal(trust.users.length, 0);
    assert.equal(trust.workspaces.length, 0);

    console.log("ok: overview + customers + billing events + models + flags section queries");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/Can't reach database server|P1001|P1017|ECONNREFUSED|does not exist|DATABASE_URL/i.test(message)) {
      console.log("skip: Postgres admin section smoke (start docker compose or migrate)");
      return;
    }
    throw error;
  } finally {
    await prisma.$disconnect().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
