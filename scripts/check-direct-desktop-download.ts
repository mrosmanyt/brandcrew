/**
 * Windows installer CTAs must hit GitHub Releases CDN — never stream via Vercel.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  cinemAiAssistantAdvancedDownloadHref,
  cinemAiAssistantDownloadHref,
  isExternalDirectInstallerUrl,
  validatedDesktopInstallerEnvUrl,
} from "../src/lib/cinem-ai-assistant";
import { DESKTOP_WIN_DOWNLOAD } from "../src/lib/site";
import { resolveCinemAiAssistantDownload } from "../src/server/api/downloads/cinem-ai-assistant";

const DIRECT_HOST = /cinem-pro-releases|release-assets\.githubusercontent\.com/;

function assertDirectInstallerHref(href: string, label: string) {
  assert.match(href, /^https:\/\//, `${label} must be absolute https`);
  assert.doesNotMatch(href, /^\/api\//, `${label} must not use API route`);
  assert.doesNotMatch(href, /^\/downloads\//, `${label} must not use app /downloads`);
  assert.doesNotMatch(href, /app\.cinem\.(tech|pro)/, `${label} must not proxy through app origin`);
  assert.match(href, DIRECT_HOST, `${label} must use GitHub Releases CDN`);
}

assert.equal(isExternalDirectInstallerUrl(DESKTOP_WIN_DOWNLOAD), true);
assert.equal(isExternalDirectInstallerUrl("/api/downloads/cinem-ai-assistant"), false);
assert.equal(isExternalDirectInstallerUrl("/downloads/CINEM-Pro-Setup.exe"), false);
assert.equal(isExternalDirectInstallerUrl("https://app.cinem.tech/downloads/CINEM-Pro-Setup.exe"), false);
assert.equal(
  isExternalDirectInstallerUrl(
    "https://release-assets.githubusercontent.com/github-production-release-asset/1/setup.exe",
  ),
  true,
);
console.log("ok: external direct installer URL guard");

const prevPublic = process.env.NEXT_PUBLIC_CINEM_AI_ASSISTANT_SETUP_URL;
const prevServer = process.env.CINEM_AI_ASSISTANT_SETUP_URL;
process.env.NEXT_PUBLIC_CINEM_AI_ASSISTANT_SETUP_URL = "/api/downloads/cinem-ai-assistant";
process.env.CINEM_AI_ASSISTANT_SETUP_URL = "";
assert.equal(validatedDesktopInstallerEnvUrl(), "");
assert.equal(cinemAiAssistantDownloadHref(), DESKTOP_WIN_DOWNLOAD);
process.env.NEXT_PUBLIC_CINEM_AI_ASSISTANT_SETUP_URL = DESKTOP_WIN_DOWNLOAD;
assert.equal(validatedDesktopInstallerEnvUrl(), DESKTOP_WIN_DOWNLOAD);
process.env.NEXT_PUBLIC_CINEM_AI_ASSISTANT_SETUP_URL = prevPublic ?? "";
process.env.CINEM_AI_ASSISTANT_SETUP_URL = prevServer ?? "";
console.log("ok: env override ignores app-server paths");

assertDirectInstallerHref(cinemAiAssistantDownloadHref(), "cinemAiAssistantDownloadHref");
assertDirectInstallerHref(cinemAiAssistantAdvancedDownloadHref(), "advanced download href");
assertDirectInstallerHref(resolveCinemAiAssistantDownload(false).href, "resolve unified");
assertDirectInstallerHref(resolveCinemAiAssistantDownload(true).href, "resolve advanced");
console.log("ok: resolver + CTA helpers are direct CDN URLs");

const apiSource = readFileSync("src/server/api/downloads/cinem-ai-assistant.ts", "utf8");
assert.doesNotMatch(apiSource, /readFileSync|existsSync/);
assert.match(apiSource, /NextResponse\.redirect/);
console.log("ok: download API redirects only (no serverless streaming)");

const nextConfig = readFileSync("next.config.ts", "utf8");
assert.match(nextConfig, /\/downloads\/\$\{WIN_SETUP_FILENAME\}/);
assert.match(nextConfig, /DESKTOP_WIN_DOWNLOAD/);
const redirects = readFileSync("src/lib/desktop-download-redirects.ts", "utf8");
assert.match(redirects, /DESKTOP_CDN_BASE_URL/);
assert.match(redirects, /releases\/latest\/download/);
console.log("ok: /downloads/*.exe redirects to releases CDN (optional DESKTOP_CDN_BASE_URL)");

const downloadsDir = join(process.cwd(), "public/downloads");
const probe = join(downloadsDir, "CINEM-Pro-Setup.exe");
const hadProbe = existsSync(probe);
if (!existsSync(downloadsDir)) mkdirSync(downloadsDir, { recursive: true });
writeFileSync(probe, "probe");
assertDirectInstallerHref(resolveCinemAiAssistantDownload(false).href, "resolve with local probe file");
if (!hadProbe) unlinkSync(probe);
console.log("ok: local public/downloads probe does not change resolver");

console.log("Direct desktop download checks passed.");
