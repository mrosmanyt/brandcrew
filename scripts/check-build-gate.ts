/**
 * Build gate + guest chat contracts.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  DESKTOP_BUILD_REQUIRED_CODE,
  intentRequiresDesktopBuild,
  messageLooksLikeBuildIntent,
  playbookUsesLocalFiles,
} from "../src/lib/build-gate";
import { GUEST_CHAT_MESSAGE_LIMIT } from "../src/lib/guest-chat-pure";
import { DEFAULT_LOCALE } from "../src/lib/i18n-default";
import { API_ROUTES } from "../src/server/api/router";

assert.equal(DEFAULT_LOCALE, "en");
assert.equal(GUEST_CHAT_MESSAGE_LIMIT, 10);

assert.equal(intentRequiresDesktopBuild({ action: "build_website" }), true);
assert.equal(intentRequiresDesktopBuild({ action: "default", message: "build a website for my cafe" }), true);
assert.equal(intentRequiresDesktopBuild({ action: "default", message: "what is our ICP?" }), false);
assert.equal(messageLooksLikeBuildIntent("make an app for inventory"), true);
assert.equal(playbookUsesLocalFiles("website_builder"), true);
assert.equal(DESKTOP_BUILD_REQUIRED_CODE, "DESKTOP_BUILD_REQUIRED");

assert.ok(
  API_ROUTES.some((row) => row.pattern.join("/") === "api/guest/chat"),
  "guest chat route registered",
);

const composer = readFileSync("src/components/desk/chat-composer.tsx", "utf8");
assert.match(composer, /DesktopBuildRequiredDialog/);
assert.match(composer, /buildLocked/);

const sidebar = readFileSync("src/components/desk/sidebar.tsx", "utf8");
assert.match(sidebar, /BuildSidebarSection/);

const chat = readFileSync("src/app/chat/page.tsx", "utf8");
assert.match(chat, /GuestChatHome/);

const preload = readFileSync("electron/preload.cjs", "utf8");
assert.match(preload, /runLocalBuild/);
assert.match(preload, /pickProjectFolder/);

const main = readFileSync("electron/main.cjs", "utf8");
assert.match(main, /local-builder/);
assert.match(main, /cinem:run-local-build/);

console.log("ok: build gate + guest chat");
