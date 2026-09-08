/**
 * Internal Admin HQ: email allow-list, 403 authz, section payloads.
 * Prisma section smokes skipped if Postgres is down.
 */
import assert from "node:assert/strict";
import {
  ADMIN_SECTIONS,
  DEFAULT_ADMIN_EMAIL,
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
import { ForbiddenError } from "../src/lib/auth";
import { prisma } from "../src/lib/db";
import { jsonError } from "../src/lib/http";

async function main() {
  assert.deepEqual(parseAdminEmails(""), [DEFAULT_ADMIN_EMAIL]);
  assert.deepEqual(parseAdminEmails(undefined), [DEFAULT_ADMIN_EMAIL]);
  assert.ok(parseAdminEmails("ada@cinem.tech").includes(DEFAULT_ADMIN_EMAIL));
  assert.ok(parseAdminEmails("ada@cinem.tech").includes("ada@cinem.tech"));
  assert.equal(parseAdminEmails("Ada@cinem.tech, ada@cinem.tech").length, 2);
  console.log("ok: ADMIN_EMAILS always includes cinemtech@gmail.com");

  const saved = process.env.ADMIN_EMAILS;
  delete process.env.ADMIN_EMAILS;
  assert.equal(isAdminEmail("cinemtech@gmail.com"), true);
  assert.equal(isAdminEmail("CINEMTECH@gmail.com"), true);
  assert.equal(isAdminEmail("user@example.com"), false);
  assert.equal(isAdminEmail("qa.cinem.pro.20260907@example.com"), false);
  process.env.ADMIN_EMAILS = "ops@cinem.tech";
  assert.equal(isAdminEmail("ops@cinem.tech"), true);
  assert.equal(isAdminEmail("cinemtech@gmail.com"), true);
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
  ]);
  assert.equal(sanitizeFlagKey(" Jobs_Kill.Switch "), "jobs_kill.switch");
  assert.equal(sanitizeFlagKey("$$$"), "");
  console.log("ok: section + flag key parsers");

  const access = getAdminAccess();
  assert.equal(access.section, "access");
  assert.equal(access.role, "superadmin");
  assert.equal(access.source, "ADMIN_EMAILS");
  assert.equal(access.sso.status, "not_wired");
  assert.ok(access.emails.some((row) => row.isDefault && row.domain === "gmail.com"));
  assert.equal(JSON.stringify(access.emails).includes("cinemtech@"), false);
  assert.match(access.note, /Vercel/);
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
  console.log("ok: ForbiddenError serializes as HTTP 403");

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

    const customers = await getAdminCustomers({ q: "nobody-at-cinem.invalid" });
    assert.equal(customers.section, "customers");
    assert.ok(Array.isArray(customers.results));

    const billing = await getAdminBilling();
    assert.equal(billing.section, "billing");
    assert.equal(billing.credits, null);
    assert.ok(Array.isArray(billing.paid));

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

    console.log("ok: overview + customers + billing + models + flags section queries");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/Can't reach database server|P1001|P1017|ECONNREFUSED|does not exist/i.test(message)) {
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
