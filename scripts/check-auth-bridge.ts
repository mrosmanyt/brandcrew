/**
 * Multi-surface auth bridge: tokens, connect tickets, download hub,
 * extension Sign in with CINEM, desktop protocol, Android scaffold.
 * No database.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import {
  ACCESS_TOKEN_TTL_SEC,
  ANDROID_PACKAGE_ID,
  CHROME_WEB_STORE_URL,
  CLOUD_DESK_ORIGIN,
  CONNECT_TICKET_TTL_MS,
  DESKTOP_PROTOCOL,
  REFRESH_TOKEN_PREFIX,
  connectPath,
  desktopDeepLink,
  isConnectSurface,
  nonceFromLoginLink,
  parseConnectNonce,
} from "../src/lib/auth-bridge";
import { sensitiveRateLimit } from "../src/lib/rate-limit";
import { ANDROID_PACKAGE_ID as SITE_ANDROID_PACKAGE, CHROME_EXTENSION_ZIP, SITE_ORIGIN, VERCEL_SITE_ORIGIN } from "../src/lib/site";
import { API_ROUTES } from "../src/server/api/router";

assert.equal(DESKTOP_PROTOCOL, "cinem-pro");
assert.equal(ANDROID_PACKAGE_ID, "tech.cinem.pro");
assert.equal(SITE_ANDROID_PACKAGE, "tech.cinem.pro");
assert.equal(CLOUD_DESK_ORIGIN, SITE_ORIGIN);
assert.equal(CLOUD_DESK_ORIGIN, "https://app.cinem.tech");
assert.equal(VERCEL_SITE_ORIGIN, "https://brandcrew.vercel.app");
assert.equal(CHROME_WEB_STORE_URL, "");
assert.equal(REFRESH_TOKEN_PREFIX, "cinem_rt_");
assert.equal(ACCESS_TOKEN_TTL_SEC, 30 * 24 * 60 * 60);
assert.ok(CONNECT_TICKET_TTL_MS >= 10 * 60 * 1000);
assert.equal(isConnectSurface("extension"), true);
assert.equal(isConnectSurface("web"), false);
assert.equal(parseConnectNonce("xyz"), null);
assert.ok(parseConnectNonce("ab".repeat(8)));
assert.equal(
  nonceFromLoginLink("https://app.cinem.tech/connect/extension?nonce=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"),
  "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
);
assert.equal(
  nonceFromLoginLink("https://brandcrew.vercel.app/connect/extension?nonce=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"),
  "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
);
assert.match(connectPath("extension", "aa".repeat(16)), /^\/connect\/extension\?nonce=/);
assert.match(desktopDeepLink("aa".repeat(16), SITE_ORIGIN), /^cinem-pro:\/\/connect\?/);
console.log("ok: auth-bridge constants + nonce parsing");

const routeJoin = API_ROUTES.map((route) => route.pattern.join("/"));
for (const path of [
  "api/auth/token",
  "api/auth/refresh",
  "api/auth/revoke",
  "api/auth/connect",
  "api/auth/connect/approve",
  "api/auth/connect/claim",
]) {
  assert.equal(routeJoin.includes(path), true, `missing ${path}`);
}
assert.ok(sensitiveRateLimit(["api", "auth", "token"], "POST"));
assert.ok(sensitiveRateLimit(["api", "auth", "connect"], "POST"));
assert.ok(sensitiveRateLimit(["api", "auth", "refresh"], "POST"));
console.log("ok: native auth routes registered + rate-limited");

const auth = readFileSync("src/lib/auth.ts", "utf8");
assert.match(auth, /readRequestSessionToken/);
assert.match(auth, /authorization/);
assert.match(auth, /SESSION_COOKIE/);
const login = readFileSync("src/server/api/auth/login.ts", "utf8");
assert.match(login, /setSessionCookie/);
assert.match(login, /wantsNativeTokens/);
assert.doesNotMatch(login, /localStorage/);
console.log("ok: web cookie login still sets the session cookie; Bearer is additive");

assert.ok(existsSync("docs/auth-bridge.md"));
assert.ok(existsSync("docs/play-store-launch.md"));
assert.ok(existsSync("src/app/download/page.tsx"));
assert.ok(existsSync("src/app/connect/[surface]/page.tsx"));
assert.ok(existsSync("src/app/connect/session/page.tsx"));
assert.match(readFileSync("src/app/api/[...path]/route.ts", "utf8"), /export const OPTIONS/);
assert.match(readFileSync("src/app/download/page.tsx", "utf8"), /Get desktop/);
assert.match(readFileSync("src/app/download/page.tsx", "utf8"), /Get Android/);
assert.match(readFileSync("src/app/download/page.tsx", "utf8"), /Get Chrome extension/);
assert.equal(CHROME_EXTENSION_ZIP, "/downloads/cinem-pro-chrome.zip");
assert.match(readFileSync("src/components/marketing/site-nav.tsx", "utf8"), /href: "\/download"/);
console.log("ok: /download hub + connect pages");

const popup = readFileSync("extension/popup.html", "utf8");
assert.match(popup, /Sign in with CINEM/);
assert.match(popup, /paste login link/i);
assert.match(readFileSync("extension/background.js", "utf8"), /auth\/connect\/claim/);
assert.match(readFileSync("extension/background.js", "utf8"), /startSignIn/);
assert.match(readFileSync("extension/manifest.json", "utf8"), /"version": "0\.2\.2"/);
const deskOrigin = readFileSync("extension/desk-origin.js", "utf8");
assert.match(deskOrigin, /DEFAULT_DESK_ORIGIN = "https:\/\/app\.cinem\.tech"/);
assert.match(readFileSync("extension/popup.js", "utf8"), /DEFAULT_DESK_ORIGIN/);
assert.match(readFileSync("extension/background.js", "utf8"), /DEFAULT_DESK_ORIGIN/);
assert.doesNotMatch(readFileSync("extension/popup.js", "utf8"), /brandcrew\.vercel\.app/);
assert.doesNotMatch(readFileSync("extension/background.js", "utf8"), /brandcrew\.vercel\.app/);
assert.match(readFileSync("extension/popup.html", "utf8"), /https:\/\/app\.cinem\.tech/);
assert.match(readFileSync("extension/manifest.json", "utf8"), /brandcrew\.vercel\.app/);
const onDevice = readFileSync("src/components/desk/on-device-setup.tsx", "utf8");
assert.match(onDevice, /Download extension/);
assert.match(onDevice, /Sign in with CINEM/);
assert.match(onDevice, /<details/);
assert.match(onDevice, /Developer: Load unpacked/);
const onDeviceIndex = onDevice.indexOf("Download extension");
const unpackedIndex = onDevice.indexOf("Load unpacked");
assert.ok(onDeviceIndex >= 0 && unpackedIndex > onDeviceIndex);
console.log("ok: extension Sign in with CINEM; On-device is download-first");

const electron = readFileSync("electron/main.cjs", "utf8");
assert.match(electron, /cinem-pro/);
assert.match(electron, /CINEM_DESK_MODE/);
assert.match(electron, /accounts\.google\.com/);
assert.match(electron, /https:\/\/app\.cinem\.tech/);
assert.match(electron, /brandcrew\.vercel\.app/);
assert.match(electron, /\/desk/);
assert.match(electron, /setAsDefaultProtocolClient/);
assert.match(readFileSync("package.json", "utf8"), /"schemes": \[\s*"cinem-pro"/);
console.log("ok: Electron cloud desk + protocol handler");

assert.ok(existsSync("mobile/app.json"));
assert.ok(existsSync("mobile/App.tsx"));
assert.ok(existsSync("mobile/eas.json"));
const appJson = JSON.parse(readFileSync("mobile/app.json", "utf8")) as {
  expo: { name: string; android: { package: string } };
};
assert.equal(appJson.expo.name, "CINEM Pro");
assert.equal(appJson.expo.android.package, "tech.cinem.pro");
assert.match(readFileSync("mobile/src/config.ts", "utf8"), /DEFAULT_ORIGIN = "https:\/\/app\.cinem\.tech"/);
assert.match(readFileSync("mobile/App.tsx", "utf8"), /loginWithPassword/);
assert.match(readFileSync("mobile/src/auth.ts", "utf8"), /expo-secure-store/);
assert.match(readFileSync("docs/play-store-launch.md", "utf8"), /eas build/);
assert.match(readFileSync("docs/play-store-launch.md", "utf8"), /iOS App Store/);
console.log("ok: Android Expo scaffold + Play docs");

const sidebar = readFileSync("src/components/desk/sidebar.tsx", "utf8");
assert.equal(sidebar.includes("/brand-kit"), false);
assert.match(readFileSync("src/components/desk/settings-hub.tsx", "utf8"), /brand-kit/);
console.log("ok: Brand Kit stays under Settings (PR #49)");

console.log("Auth bridge checks passed.");
