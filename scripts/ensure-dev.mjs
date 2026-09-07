import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { isFileDatabaseUrl, LOCAL_DATABASE_URL } from "./prisma-env.mjs";

function parseEnvFile(contents) {
  const out = {};
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[trimmed.slice(0, eq).trim()] = value;
  }
  return out;
}

function upsertEnvLine(contents, key, value) {
  const line = `${key}="${value}"`;
  const re = new RegExp(`^${key}=.*$`, "m");
  if (re.test(contents)) return contents.replace(re, line);
  return `${contents.trimEnd()}\n${line}\n`;
}

if (!existsSync(".env")) {
  copyFileSync(".env.example", ".env");
  console.log("Created .env from .env.example");
}

let envText = readFileSync(".env", "utf8");
const parsed = parseEnvFile(envText);
let rewritten = false;

if (isFileDatabaseUrl(parsed.DATABASE_URL)) {
  envText = upsertEnvLine(envText, "DATABASE_URL", LOCAL_DATABASE_URL);
  rewritten = true;
  console.warn(
    "DATABASE_URL was a SQLite file. Prisma now uses Postgres. Wrote local Docker URL.\n" +
      "Start it with: docker compose up -d\n" +
      "Old dev.db is not migrated automatically.",
  );
}
if (!parsed.DIRECT_URL || isFileDatabaseUrl(parsed.DIRECT_URL)) {
  const db = isFileDatabaseUrl(parsed.DATABASE_URL)
    ? LOCAL_DATABASE_URL
    : parsed.DATABASE_URL || LOCAL_DATABASE_URL;
  envText = upsertEnvLine(envText, "DIRECT_URL", db);
  rewritten = true;
}
if (rewritten) writeFileSync(".env", envText);

function runPrisma(args) {
  return spawnSync(process.platform === "win32" ? "npx.cmd" : "npx", ["prisma", ...args], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
}

const generate = runPrisma(["generate"]);
if (generate.status !== 0) process.exit(generate.status ?? 1);

function migrateDeploy() {
  return runPrisma(["migrate", "deploy"]);
}

let migrate = migrateDeploy();
if (migrate.status !== 0) {
  console.warn("Postgres is not reachable. Trying docker compose up -d …");
  const compose = spawnSync("docker", ["compose", "up", "-d", "--wait"], { stdio: "inherit" });
  if (compose.status === 0) {
    migrate = migrateDeploy();
  }
}

if (migrate.status !== 0) {
  console.error(
    "Could not apply Prisma migrations.\n" +
      "Start local Postgres (docker compose up -d) or set DATABASE_URL / DIRECT_URL to Neon, then retry.",
  );
  process.exit(migrate.status ?? 1);
}
