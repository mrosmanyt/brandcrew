#!/usr/bin/env node
/**
 * prisma generate with a dummy postgresql:// URL when DATABASE_URL is missing
 * or still a SQLite file: URL so `npm run build` / postinstall work without a live DB.
 *
 * Also fills blank DIRECT_URL from DATABASE_URL (Vercel often creates it empty).
 * Pass --with-migrate to run `prisma migrate deploy` with the same env (Vercel).
 */
import { spawnSync } from "node:child_process";
import { prismaGenerateEnv } from "./prisma-env.mjs";

const env = prismaGenerateEnv();
const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const withMigrate = process.argv.includes("--with-migrate");

function run(args) {
  const result = spawnSync(npx, args, {
    stdio: "inherit",
    env,
    shell: process.platform === "win32",
  });
  if ((result.status ?? 1) !== 0) process.exit(result.status ?? 1);
}

run(["prisma", "generate"]);
if (withMigrate) run(["prisma", "migrate", "deploy"]);
