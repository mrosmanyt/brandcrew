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
  "/console?workspace=ws_1",
);
assert.equal(consoleAppHref({ hostname: "console.cinem.tech" }), "/");
assert.equal(
  consoleAppHref({ hostname: "console.cinem.tech", workspaceId: "ws_1" }),
  "/?workspace=ws_1",
);

const saved = process.env.NEXT_PUBLIC_CONSOLE_URL;
process.env.NEXT_PUBLIC_CONSOLE_URL = "https://console.cinem.tech";
assert.equal(consoleDomainReady("brandcrew.vercel.app"), true);
assert.equal(
  consoleAppHref({ hostname: "brandcrew.vercel.app" }),
  "/console",
  "customer nav stays on /console even if NEXT_PUBLIC_CONSOLE_URL is set",
);
if (saved === undefined) delete process.env.NEXT_PUBLIC_CONSOLE_URL;
else process.env.NEXT_PUBLIC_CONSOLE_URL = saved;
console.log("ok: customer console href is same-origin /console (not console.cinem.tech)");

const sidebar = readFileSync("src/components/desk/sidebar.tsx", "utf8");
assert.match(sidebar, /ConsoleNavLink/);
assert.match(sidebar, /API Console/);
assert.equal(sidebar.includes("console.cinem.tech"), false);
assert.equal(sidebar.includes("/brand-kit"), false);
assert.equal(sidebar.includes("/developers"), false);
const navLink = readFileSync("src/components/desk/console-nav-link.tsx", "utf8");
assert.match(navLink, /consoleAppHref/);
assert.equal(navLink.includes("console.cinem.tech"), false);
const deskSettings = readFileSync("src/lib/desk-settings.ts", "utf8");
assert.match(deskSettings, /\/console\?workspace=/);
assert.doesNotMatch(deskSettings, /console\.cinem\.tech/);
const settings = readFileSync("src/components/desk/settings-hub.tsx", "utf8");
const settingsLib = readFileSync("src/lib/desk-settings.ts", "utf8");
assert.match(settings, /Workspace/);
assert.match(settings, /settingsDeskCategories/);
assert.match(settingsLib, /title: "Integrations"/);
assert.match(settingsLib, /title: "Desk tools"/);
assert.match(settingsLib, /brand-kit/);
const proxy = readFileSync("src/proxy.ts", "utf8");
assert.match(proxy, /isConsoleHostname/);
assert.match(proxy, /CONSOLE_PATH/);
assert.ok(readFileSync("src/app/console/page.tsx", "utf8").includes("ConsoleApp"));
assert.ok(readFileSync("src/app/robots.ts", "utf8").includes("/console"));
console.log("ok: sidebar opens console; Brand Kit is Settings-only");

console.log("Console site checks passed.");
