#!/usr/bin/env node
/**
 * prisma generate with a dummy postgresql:// URL when DATABASE_URL is missing
 * or still a SQLite file: URL so `npm run build` / postinstall work without a live DB.
 */
import { spawnSync } from "node:child_process";
import { prismaGenerateEnv } from "./prisma-env.mjs";

const result = spawnSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["prisma", "generate"],
  {
    stdio: "inherit",
    env: prismaGenerateEnv(),
    shell: process.platform === "win32",
  },
);

process.exit(result.status ?? 1);
