/**
 * Sidebar "New workspace" contract: name rules + POST on the catch-all.
 * No database.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

const schema = z.object({
  name: z.string().trim().min(1).max(80),
});

assert.equal(schema.safeParse({ name: "" }).success, false);
assert.equal(schema.safeParse({ name: "   " }).success, false);
assert.equal(schema.safeParse({}).success, false);
assert.deepEqual(schema.parse({ name: "  Acme  " }), { name: "Acme" });
assert.equal(schema.safeParse({ name: "x".repeat(81) }).success, false);
console.log("ok: workspace create name is required and trimmed");

const root = process.cwd();
const collection = readFileSync(join(root, "src/server/api/workspaces/collection.ts"), "utf8");
assert.match(collection, /export async function POST/);
assert.match(collection, /createDemoWorkspace/);
assert.match(collection, /z\.string\(\)\.trim\(\)\.min\(1\)\.max\(80\)/);

const sidebar = readFileSync(join(root, "src/components/desk/sidebar.tsx"), "utf8");
assert.match(sidebar, /fetch\("\/api\/workspaces"/);
assert.match(sidebar, /method: "POST"/);
assert.match(sidebar, /onClick=\{\(\) => void createWorkspace\(\)\}/);
assert.match(sidebar, /if \(e\.key !== "Enter"\) return/);
assert.match(sidebar, /Enter a workspace name/);
assert.match(sidebar, /Could not create workspace/);
assert.match(sidebar, /router\.push\(`\/onboarding\?workspace=\$\{encodeURIComponent\(data\.workspace\.id\)\}`\)/);
console.log("ok: + click and Enter POST /api/workspaces then switch desk");

const router = readFileSync(join(root, "src/server/api/router.ts"), "utf8");
assert.match(
  router,
  /pattern: \["api", "workspaces"\], handlers: asHandlers\(workspacesCollection\)/,
);
console.log("ok: POST /api/workspaces stays on the Hobby catch-all");

console.log("Workspace create checks passed.");
