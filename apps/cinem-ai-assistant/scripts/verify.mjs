/**
 * Cinem AI Assistant verify — local replacement for the cloud sandbox typecheck.
 * Runs TypeScript typecheck + sidecar syntax check + a quick health probe.
 *
 *   npm run verify
 */
import { spawnSync, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import http from "node:http";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const G = "\x1b[32m", R = "\x1b[31m", Y = "\x1b[33m", C = "\x1b[36m", X = "\x1b[0m";
let failed = false;

function step(title) { console.log(`\n${C}━━ ${title}${X}`); }

// 1) TypeScript
step("1/3  TypeScript typecheck (tsc --noEmit)");
const tsc = spawnSync(process.platform === "win32" ? "npx.cmd" : "npx",
  ["tsc", "--noEmit"], { cwd: ROOT, stdio: "inherit", shell: true });
if (tsc.status === 0) console.log(`${G}✓ no type errors${X}`);
else { console.log(`${R}✗ type errors above${X}`); failed = true; }

// 2) Sidecar JS syntax (node --check)
step("2/3  Sidecar syntax check");
for (const dir of ["db-server", "playwright-server", "media-server"]) {
  const entry = path.join(ROOT, dir, "index.js");
  if (!existsSync(entry)) { console.log(`${Y}• ${dir}: not found (skip)${X}`); continue; }
  const chk = spawnSync(process.execPath, ["--check", entry], { stdio: "pipe" });
  if (chk.status === 0) console.log(`${G}✓ ${dir}${X}`);
  else { console.log(`${R}✗ ${dir}\n${chk.stderr}${X}`); failed = true; }
}

// 3) Media-server live health (only if already running)
step("3/3  Media-server /health probe (optional)");
const probe = () => new Promise((res) => {
  const req = http.get("http://127.0.0.1:7880/health", (r) => res(r.statusCode === 200));
  req.on("error", () => res(false));
  req.setTimeout(1200, () => { req.destroy(); res(false); });
});
const up = await probe();
console.log(up ? `${G}✓ media-server is up (Phase 3 /assemble ready)${X}`
              : `${Y}• media-server not running — run "npm run sidecars" to start it${X}`);

console.log(failed ? `\n${R}VERIFY FAILED — fix errors above${X}`
                   : `\n${G}VERIFY PASSED ✓${X}`);
process.exit(failed ? 1 : 0);
