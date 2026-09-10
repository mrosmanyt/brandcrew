/**
 * Developer console host routing and href fallback.
 * No database.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CONSOLE_HOST,
  CONSOLE_ORIGIN,
  CONSOLE_PATH,
  consoleAppHref,
  consoleDomainReady,
  isConsoleHostname,
} from "../src/lib/console-site";

assert.equal(CONSOLE_HOST, "console.cinem.tech");
assert.equal(CONSOLE_ORIGIN, "https://console.cinem.tech");
assert.equal(CONSOLE_PATH, "/console");
assert.equal(isConsoleHostname("console.cinem.tech"), true);
assert.equal(isConsoleHostname("console.cinem.tech:443"), true);
assert.equal(isConsoleHostname("brandcrew.vercel.app"), false);

assert.equal(consoleAppHref({ hostname: "localhost" }), "/console");
assert.equal(
  consoleAppHref({ hostname: "127.0.0.1", workspaceId: "ws_1" }),
  "/console?workspace=ws_1",
);
assert.equal(
  consoleAppHref({ hostname: "brandcrew.vercel.app" }),
  "/console",
);
assert.equal(consoleDomainReady("brandcrew.vercel.app"), false);
assert.equal(consoleDomainReady("app.cinem.tech"), true);
assert.equal(
  consoleAppHref({ hostname: "app.cinem.tech", workspaceId: "ws_1" }),
  "https://console.cinem.tech?workspace=ws_1",
);
assert.equal(consoleAppHref({ hostname: "console.cinem.tech" }), "/");
assert.equal(
  consoleAppHref({ hostname: "console.cinem.tech", workspaceId: "ws_1" }),
  "/?workspace=ws_1",
);

const saved = process.env.NEXT_PUBLIC_CONSOLE_URL;
process.env.NEXT_PUBLIC_CONSOLE_URL = "https://console.cinem.tech";
assert.equal(consoleDomainReady("brandcrew.vercel.app"), true);
assert.equal(consoleAppHref({ hostname: "brandcrew.vercel.app" }), "https://console.cinem.tech");
if (saved === undefined) delete process.env.NEXT_PUBLIC_CONSOLE_URL;
else process.env.NEXT_PUBLIC_CONSOLE_URL = saved;
console.log("ok: console href prefers subdomain when ready, else /console");

const sidebar = readFileSync("src/components/desk/sidebar.tsx", "utf8");
assert.match(sidebar, /ConsoleNavLink/);
assert.match(sidebar, /API Console/);
assert.equal(sidebar.includes("/brand-kit"), false);
assert.equal(sidebar.includes("/developers"), false);
const settings = readFileSync("src/components/desk/settings-hub.tsx", "utf8");
assert.match(settings, /Workspace kit/);
assert.match(settings, /brand-kit/);
const proxy = readFileSync("src/proxy.ts", "utf8");
assert.match(proxy, /isConsoleHostname/);
assert.match(proxy, /CONSOLE_PATH/);
assert.ok(readFileSync("src/app/console/page.tsx", "utf8").includes("ConsoleApp"));
assert.ok(readFileSync("src/app/robots.ts", "utf8").includes("/console"));
console.log("ok: sidebar opens console; Brand Kit is Settings-only");

console.log("Console site checks passed.");
