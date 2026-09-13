/**
 * Packaged Electron is a cloud desk shell, not a local Next/Postgres stack.
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const shell = require("../electron/desk-shell.cjs") as {
  PRODUCTION_DESK_ORIGIN: string;
  VERCEL_DESK_ORIGIN: string;
  DESKTOP_SHELL_VERSION: string;
  SESSION_COOKIE: string;
  PROTOCOL: string;
  resolveCloudOrigin: (env?: NodeJS.ProcessEnv) => string;
  useCloudDesk: (input: { packaged: boolean; env?: NodeJS.ProcessEnv }) => boolean;
  resolveDeskOrigin: (input: { packaged: boolean; env?: NodeJS.ProcessEnv }) => string;
  isPublicHttpsOrigin: (raw: string) => boolean;
  isAllowedNavigation: (
    url: string,
    opts?: { deskOrigin?: string; localOrigin?: string; assistantOrigin?: string },
  ) => boolean;
  isPaymentExternal: (url: string) => boolean;
  isGoogleUserLoginUrl: (url: string) => boolean;
  classifyDesktopNavigation: (
    url: string,
    opts?: { deskOrigin?: string; localOrigin?: string; assistantOrigin?: string },
  ) => string;
  chromeUserAgent: (raw: string) => string;
  isIgnorableLoadError: (code: number) => boolean;
  deskPath: (pathName?: string) => string;
};

assert.equal(shell.PRODUCTION_DESK_ORIGIN, "https://app.cinem.tech");
assert.equal(shell.VERCEL_DESK_ORIGIN, "https://brandcrew.vercel.app");
assert.equal(shell.SESSION_COOKIE, "brandcrew_session");
assert.equal(shell.PROTOCOL, "cinem-pro");
assert.match(shell.DESKTOP_SHELL_VERSION, /^\d+\.\d+\.\d+$/);
console.log("ok: desktop shell constants");

assert.equal(shell.isPublicHttpsOrigin("https://app.cinem.tech"), true);
assert.equal(shell.isPublicHttpsOrigin("https://brandcrew.vercel.app"), true);
assert.equal(shell.isPublicHttpsOrigin("http://127.0.0.1:43180"), false);
assert.equal(shell.isPublicHttpsOrigin("https://127.0.0.1"), false);
assert.equal(shell.isPublicHttpsOrigin("http://app.cinem.tech"), false);
assert.equal(shell.isPublicHttpsOrigin("https://localhost"), false);
console.log("ok: public HTTPS origin filter");

assert.equal(shell.resolveCloudOrigin({}), "https://app.cinem.tech");
assert.equal(
  shell.resolveCloudOrigin({ APP_URL: "http://127.0.0.1:43180" }),
  "https://app.cinem.tech",
);
assert.equal(
  shell.resolveCloudOrigin({ NEXT_PUBLIC_APP_URL: "http://localhost:3000" }),
  "https://app.cinem.tech",
);
assert.equal(
  shell.resolveCloudOrigin({
    APP_URL: "http://127.0.0.1:43180",
    CINEM_CLOUD_URL: "https://brandcrew.vercel.app",
  }),
  "https://brandcrew.vercel.app",
);
assert.equal(
  shell.useCloudDesk({ packaged: true, env: {} }),
  true,
  "packaged Setup.exe defaults to cloud",
);
assert.equal(shell.useCloudDesk({ packaged: true, env: { CINEM_DESK_MODE: "local" } }), false);
assert.equal(shell.useCloudDesk({ packaged: false, env: {} }), false);
assert.equal(shell.useCloudDesk({ packaged: false, env: { CINEM_DESK_MODE: "cloud" } }), true);
assert.equal(
  shell.resolveDeskOrigin({
    packaged: true,
    env: { APP_URL: "http://127.0.0.1:43180", NEXT_PUBLIC_APP_URL: "http://127.0.0.1:43180" },
  }),
  "https://app.cinem.tech",
);
console.log("ok: packaged cloud desk ignores localhost APP_URL");

const desk = "https://app.cinem.tech";
const local = "http://127.0.0.1:43180";
const stay = (url: string) =>
  shell.isAllowedNavigation(url, {
    deskOrigin: desk,
    localOrigin: local,
    assistantOrigin: "http://127.0.0.1:1420",
  });
assert.equal(stay("https://app.cinem.tech/desk"), true);
assert.equal(stay("https://app.cinem.tech/login"), true);
assert.equal(stay("https://accounts.google.com/o/oauth2/v2/auth"), true);
assert.equal(stay("https://accounts.youtube.com/"), true);
assert.equal(stay("https://myaccount.google.com/"), true);
assert.equal(stay("https://brandcrew.vercel.app/desk"), true);
assert.equal(stay("https://console.cinem.tech/"), true);
assert.equal(stay("https://slack.com/oauth/v2/authorize"), true);
assert.equal(stay("https://www.notion.so/"), true);
assert.equal(stay("https://app.composio.dev/connect"), true);
assert.equal(stay("https://www.worldmonitor.app/"), true);
assert.equal(stay("http://127.0.0.1:43180/desk"), true);
assert.equal(stay("http://127.0.0.1:1420/"), true);
assert.equal(stay("about:blank"), true);
assert.equal(shell.isPaymentExternal("https://checkout.stripe.com/c/pay/cs_test"), true);
assert.equal(shell.isPaymentExternal("https://whop.com/checkout/xxx"), true);
assert.equal(stay("https://checkout.stripe.com/c/pay/cs_test"), false);
assert.equal(stay("https://whop.com/checkout/xxx"), false);
assert.equal(stay("https://evil.example/phish"), false);
const navOpts = {
  deskOrigin: desk,
  localOrigin: local,
  assistantOrigin: "http://127.0.0.1:1420",
};
assert.equal(
  shell.classifyDesktopNavigation("https://app.cinem.tech/api/auth/google?intent=login", navOpts),
  "google-user-login",
);
assert.equal(
  shell.classifyDesktopNavigation("https://app.cinem.tech/api/auth/google?format=json", navOpts),
  "allow",
);
assert.equal(
  shell.isGoogleUserLoginUrl(
    "https://accounts.google.com/o/oauth2/v2/auth?redirect_uri=" +
      encodeURIComponent("https://app.cinem.tech/api/auth/google/callback"),
  ),
  true,
);
assert.equal(
  shell.classifyDesktopNavigation(
    "https://accounts.google.com/o/oauth2/v2/auth?redirect_uri=" +
      encodeURIComponent("https://app.cinem.tech/api/oauth/callback"),
    navOpts,
  ),
  "allow",
);
assert.equal(shell.classifyDesktopNavigation("https://checkout.stripe.com/c/pay/cs_test", navOpts), "payment");
console.log("ok: in-window OAuth vs external payments");
console.log("ok: Desk Google user login is connect-flow, plugin OAuth stays in-window");

const ua = shell.chromeUserAgent(
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.7204.251 Electron/37.10.3 Safari/537.36",
);
assert.equal(ua.includes("Electron/"), false);
assert.equal(ua.includes("Chrome/138"), true);
assert.equal(shell.isIgnorableLoadError(-3), true);
assert.equal(shell.isIgnorableLoadError(-105), false);
assert.equal(shell.deskPath("//evil"), "/desk");
assert.equal(shell.deskPath("/desk/ws_1"), "/desk/ws_1");
console.log("ok: Chrome UA + load error + desk path");

const main = readFileSync("electron/main.cjs", "utf8");
const deskSrc = readFileSync("electron/desk-shell.cjs", "utf8");
assert.match(main, /did-fail-load/);
assert.match(main, /offline\.html/);
assert.match(main, /chromeUserAgent/);
assert.match(main, /CINEM_DESK_MODE/);
assert.match(deskSrc, /https:\/\/app\.cinem\.tech/);
assert.match(deskSrc, /accounts\.google\.com/);
assert.match(deskSrc, /brandcrew\.vercel\.app/);
assert.match(deskSrc, /cinem-pro/);
assert.match(main, /setAsDefaultProtocolClient/);
assert.match(main, /installAppMenu/);
assert.match(main, /AI Assistant/);
assert.match(main, /Open both/);
assert.match(main, /chrome\.html/);
assert.match(main, /window-chrome|titleBarOverlay|titleBarStyle/);
assert.match(readFileSync("electron/chrome.html", "utf8"), /Updates/);
assert.match(readFileSync("electron/window-chrome.cjs", "utf8"), /titleBarOverlay/);
assert.match(main, /assistant-preload/);
assert.match(main, /\/privacy/);
assert.match(main, /native-host/);
assert.match(main, /host\.mjs/);
assert.match(main, /applyUserEnv/);
assert.match(main, /Never apply userData APP_URL/);
assert.match(main, /if \(useCloudDesk\(\)\)/);
assert.match(main, /showOfflinePage/);
assert.match(main, /showingOffline/);
assert.match(main, /startDesktopConnect/);
assert.match(main, /cinem:start-sign-in/);
assert.match(main, /classifyDesktopNavigation/);
assert.match(main, /UserAgentClientHint/);
assert.match(main, /startsWith\("file:"\)/);
assert.ok(existsSync("electron/sign-in.html"));
assert.match(readFileSync("electron/sign-in.html", "utf8"), /Sign in with CINEM Pro/);
assert.match(readFileSync("electron/preload.cjs", "utf8"), /startCinemSignIn/);
assert.ok(existsSync("electron/offline.html"));
assert.ok(existsSync("electron/desk-shell.cjs"));
assert.ok(existsSync("electron/preload.cjs"));
assert.match(readFileSync("electron/preload.cjs", "utf8"), /retryDesk/);
assert.match(readFileSync("electron/offline.html", "utf8"), /Can’t reach the desk|Can't reach the desk/);
assert.match(readFileSync("electron/offline.html", "utf8"), /app\.cinem\.tech/);
assert.match(readFileSync("electron/offline.html", "utf8"), /Run anyway/);
console.log("ok: main process shows retry UI instead of quitting");

const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
  version: string;
  scripts: Record<string, string>;
  build: { files: string[]; extraResources?: Array<{ to?: string }>; nsis?: unknown };
};

const modes = require("../electron/modes.cjs") as {
  normalizeMode: (raw: string) => string;
  parseStartMode: (argv?: string[], env?: NodeJS.ProcessEnv) => string;
  modeFromProtocolUrl: (raw: string) => string | null;
  assistantDevOrigin: (env?: NodeJS.ProcessEnv) => string;
  verifyShellNonce: (nonce: string) => boolean;
  ASSISTANT_PING: string;
};
assert.equal(modes.normalizeMode("ai"), "assistant");
assert.equal(modes.parseStartMode(["--mode=assistant"], {}), "assistant");
assert.equal(modes.parseStartMode([], { CINEM_START_MODE: "both" }), "both");
assert.equal(modes.modeFromProtocolUrl("cinem-pro://assistant"), "assistant");
assert.equal(modes.modeFromProtocolUrl("cinem-pro://desk"), "desk");
assert.equal(modes.assistantDevOrigin({}), "http://127.0.0.1:1420");
assert.equal(modes.verifyShellNonce("abc.12345678"), true);
assert.equal(modes.ASSISTANT_PING, "CINEM Pro core online");
console.log("ok: unified desktop modes");
assert.equal(pkg.scripts["desktop:cloud"], "node scripts/desktop-cloud.mjs");
assert.match(pkg.scripts["desktop:assistant"] ?? "", /--mode=assistant/);
assert.equal(pkg.scripts["test:desktop-shell"], "tsx scripts/check-desktop-shell.ts");
assert.equal(pkg.scripts["test:desktop-updater"], "tsx scripts/check-desktop-updater.ts");
assert.match(main, /startAutoUpdates/);
assert.match(main, /openUpdatesWindow/);
assert.match(main, /icon\.ico/);
assert.match(main, /cinem:http-get/);
for (const file of [
  "electron/main.cjs",
  "electron/preload.cjs",
  "electron/desk-shell.cjs",
  "electron/modes.cjs",
  "electron/window-chrome.cjs",
  "electron/chrome.html",
  "electron/chrome-preload.cjs",
  "electron/assistant-preload.cjs",
  "electron/offline.html",
  "electron/sign-in.html",
  "electron/updater.cjs",
  "electron/updates.html",
  "electron/updates-preload.cjs",
]) {
  assert.ok(pkg.build.files.includes(file), `package.json build.files missing ${file}`);
}
assert.ok(pkg.build.extraResources?.some((item: { to?: string }) => item.to === "assistant"));
assert.match(JSON.stringify(pkg.build.nsis || {}), /installer\.nsh/);
assert.match(JSON.stringify(pkg.build.nsis || {}), /installer\/header\.bmp/);
assert.match(JSON.stringify(pkg.build.nsis || {}), /installer\/sidebar\.bmp/);
assert.equal((pkg.build.nsis as { oneClick?: boolean }).oneClick, false);
assert.ok(existsSync("electron/resources/installer/header.bmp"));
assert.ok(existsSync("electron/resources/installer/sidebar.bmp"));
assert.ok(existsSync("electron/resources/installer/icon.ico"));
assert.ok(existsSync("docs/windows-installer-branding.md"));
assert.ok(existsSync("electron/chrome.html"));
assert.ok(existsSync("electron/window-chrome.cjs"));
assert.ok(existsSync("electron/modes.cjs"));
assert.equal(pkg.scripts["test:voices"], "tsx scripts/check-character-voices.ts");
assert.ok(existsSync("electron/resources/installer.nsh"));
assert.ok(existsSync("scripts/build-assistant-renderer.mjs"));
assert.ok(existsSync(".github/workflows/desktop-windows.yml"));
assert.equal(pkg.version, shell.DESKTOP_SHELL_VERSION);
console.log("ok: packaged files include shell + offline page");

const download = readFileSync("src/app/download/page.tsx", "utf8");
assert.match(download, /CINEM-Pro-Setup\.exe|WIN_SETUP_FILENAME/);
assert.match(download, /SmartScreen/);
assert.match(download, /app\.cinem\.tech/);
assert.match(download, /local database|Postgres/i);
assert.match(download, /Cinem AI Assistant|CINEM_AI_ASSISTANT/);
assert.match(download, /Get desktop/);
const onDevice = readFileSync("src/components/desk/on-device-setup.tsx", "utf8");
assert.match(onDevice, /\/download/);
assert.match(onDevice, /DESKTOP_WIN_DOWNLOAD|Get desktop|Windows/);
const deskLayout = readFileSync("src/app/desk/[workspaceId]/layout.tsx", "utf8");
assert.match(deskLayout, /WindowsDownloadNudge/);
assert.equal(pkg.scripts["test:win-nudge"], "tsx scripts/check-windows-download-nudge.ts");
console.log("ok: download + on-device still offer Setup.exe");

const ps1 = readFileSync("scripts/install-desktop.ps1", "utf8");
assert.match(ps1, /CINEM-Pro-Setup\.exe/);
assert.match(ps1, /cinem-pro-releases/);
assert.match(ps1, /Run anyway/);
assert.match(ps1, /CINEM_INSTALL_DEV/);
const sh = readFileSync("scripts/install-desktop.sh", "utf8");
assert.match(sh, /CINEM_DESK_MODE/);
assert.match(sh, /app\.cinem\.tech/);
assert.doesNotMatch(sh, /Mission Control on http:\/\/127\.0\.0\.1/);
console.log("ok: install scripts default to cloud / Setup.exe");

const docs = readFileSync("docs/auth-bridge.md", "utf8");
assert.match(docs, /packaged/i);
assert.match(docs, /app\.cinem\.tech/);
assert.match(docs, /CINEM_DESK_MODE=local/);
assert.match(docs, /disallowed_useragent|Chrome-like user agent|user agent/i);
assert.match(docs, /Sign in with CINEM Pro/);
assert.match(docs, /connect\/claim|connect\/desktop/);
console.log("ok: auth-bridge documents cloud default + Google UA");

console.log("Desktop shell checks passed.");
