import { copyFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

if (!existsSync(".env")) {
  copyFileSync(".env.example", ".env");
  console.log("Created .env from .env.example");
}

const generate = spawnSync("npx", ["prisma", "generate"], { stdio: "inherit" });
if (generate.status !== 0) process.exit(generate.status ?? 1);

const push = spawnSync("npx", ["prisma", "db", "push"], { stdio: "inherit" });
if (push.status !== 0) process.exit(push.status ?? 1);
