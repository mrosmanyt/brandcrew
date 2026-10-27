/**
 * Cinem AI Assistant local sandbox — starts all 3 Node sidecars together with colored,
 * prefixed logs and auto-restart on crash. Replaces the Linux sandbox for
 * day-to-day dev: db (1430), playwright (7878), media/ffmpeg (7880).
 *
 *   npm run sidecars
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const SIDECARS = [
  { name: "db",     dir: "db-server",         port: 1430, color: "\x1b[36m" },
  { name: "browser",dir: "playwright-server", port: 7878, color: "\x1b[35m" },
  { name: "media",  dir: "media-server",      port: 7880, color: "\x1b[33m" },
];
const RESET = "\x1b[0m";
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";

function startOne(s) {
  const entry = path.join(ROOT, s.dir, "index.js");
  if (!existsSync(entry)) {
    console.log(`${RED}[${s.name}] missing ${entry} — skipped${RESET}`);
    return;
  }
  const tag = `${s.color}[${s.name}:${s.port}]${RESET}`;
  console.log(`${GREEN}▶ starting${RESET} ${tag}`);
  const child = spawn(process.execPath, [entry], { cwd: ROOT, env: process.env });

  const pipe = (buf) => {
    String(buf).split(/\r?\n/).filter(Boolean).forEach((line) =>
      console.log(`${tag} ${line}`));
  };
  child.stdout.on("data", pipe);
  child.stderr.on("data", pipe);

  child.on("exit", (code) => {
    console.log(`${RED}[${s.name}] exited (code ${code}) — restarting in 2s${RESET}`);
    setTimeout(() => startOne(s), 2000);
  });
}

console.log(`${GREEN}Cinem AI Assistant sidecars${RESET} — db • browser • media (Ctrl+C to stop all)\n`);
SIDECARS.forEach(startOne);

process.on("SIGINT", () => { console.log("\nstopping sidecars…"); process.exit(0); });
