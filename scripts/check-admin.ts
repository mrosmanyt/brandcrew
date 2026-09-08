/**
 * Founder Admin HQ: email allow-list and 403 authz.
 * Dashboard/mutation smoke skipped if Postgres is down.
 */
import assert from "node:assert/strict";
import {
  DEFAULT_ADMIN_EMAIL,
  isAdminEmail,
  parseAdminEmails,
} from "../src/lib/admin";
import { ForbiddenError } from "../src/lib/auth";
import { jsonError } from "../src/lib/http";

function main() {
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
  process.env.ADMIN_EMAILS = "ops@cinem.tech";
  assert.equal(isAdminEmail("ops@cinem.tech"), true);
  assert.equal(isAdminEmail("cinemtech@gmail.com"), true);
  assert.equal(isAdminEmail("stranger@example.com"), false);
  if (saved) process.env.ADMIN_EMAILS = saved;
  else delete process.env.ADMIN_EMAILS;
  console.log("ok: non-admins are not in the allow-list");

  const forbidden = jsonError(new ForbiddenError("Admin access only."));
  assert.equal(forbidden.status, 403);
  return forbidden.json().then((body: { code?: string; error?: string }) => {
    assert.equal(body.code, "forbidden");
    assert.match(String(body.error), /admin/i);
    console.log("ok: ForbiddenError serializes as HTTP 403");
    console.log("Admin authz checks passed.");
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
