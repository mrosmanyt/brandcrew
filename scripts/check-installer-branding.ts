/**
 * CINEM Pro NSIS branding: assisted wizard, official mark art, no stock defaults.
 * Does not run electron-builder or Wine.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
  scripts: Record<string, string>;
  build: {
    productName: string;
    nsis: {
      oneClick: boolean;
      include: string;
      installerIcon?: string;
      installerHeader?: string;
      installerSidebar?: string;
      uninstallerSidebar?: string;
      uninstallDisplayName?: string;
      artifactName?: string;
    };
    win: { target: Array<{ target: string }>; icon?: string };
  };
};

assert.equal(pkg.build.productName, "CINEM Pro");
assert.equal(pkg.build.nsis.oneClick, false, "assisted installer, not sterile one-click");
assert.equal(pkg.build.nsis.include, "installer.nsh");
assert.equal(pkg.build.nsis.installerIcon, "installer/icon.ico");
assert.equal(pkg.build.nsis.installerHeader, "installer/header.bmp");
assert.equal(pkg.build.nsis.installerSidebar, "installer/sidebar.bmp");
assert.equal(pkg.build.nsis.uninstallerSidebar, "installer/sidebar.bmp");
assert.match(pkg.build.nsis.uninstallDisplayName ?? "", /Desk \+ AI Assistant/);
assert.equal(pkg.build.nsis.artifactName, "CINEM-Pro-Setup.${ext}");
assert.ok(pkg.build.win.target.some((t) => t.target === "nsis"));
assert.match(pkg.build.win.icon ?? "", /icon\.ico$/);
assert.equal(pkg.scripts["installer:art"], "node scripts/make-installer-art.mjs");
assert.equal(pkg.scripts["test:installer-branding"], "tsx scripts/check-installer-branding.ts");
assert.match(pkg.scripts["desktop:build:win"] ?? "", /desktop-build\.mjs --win/);
console.log("ok: electron-builder nsis is assisted + branded");

const nsh = readFileSync("electron/resources/installer.nsh", "utf8");
assert.match(nsh, /customWelcomePage/);
assert.match(nsh, /MUI_PAGE_WELCOME/);
assert.match(nsh, /customHeader/);
assert.match(nsh, /MUI_WELCOMEPAGE_TITLE "CINEM Pro"/);
assert.match(nsh, /Desk \+ AI Assistant/);
assert.match(nsh, /MUI_BGCOLOR 0C0C0D/);
assert.match(nsh, /customInit/);
assert.match(nsh, /installer\\splash\.bmp|installer\/splash\.bmp|installer\\\\splash\.bmp/);
assert.match(nsh, /advsplash::show|splash::show/);
assert.match(nsh, /Cinem AI Assistant\.lnk/);
assert.match(nsh, /--mode=assistant/);
assert.doesNotMatch(nsh, /MUI_PAGE_WELCOME[\s\S]*video/i);
const nshTwin = readFileSync("electron/installer.nsh", "utf8");
assert.match(nshTwin, /customWelcomePage/);
assert.match(nshTwin, /Cinem AI Assistant\.lnk/);
console.log("ok: installer.nsh welcome + splash + assistant shortcut");

function bmpSize(rel: string) {
  const buf = readFileSync(rel);
  assert.equal(buf[0], 0x42);
  assert.equal(buf[1], 0x4d);
  return {
    width: buf.readInt32LE(18),
    height: Math.abs(buf.readInt32LE(22)),
    bits: buf.readUInt16LE(28),
  };
}

const header = bmpSize("electron/resources/installer/header.bmp");
assert.deepEqual(header, { width: 150, height: 57, bits: 24 });
const sidebar = bmpSize("electron/resources/installer/sidebar.bmp");
assert.deepEqual(sidebar, { width: 164, height: 314, bits: 24 });
const splash = bmpSize("electron/resources/installer/splash.bmp");
assert.deepEqual(splash, { width: 480, height: 320, bits: 24 });
for (const frame of ["splash-0", "splash-1", "splash-2"]) {
  assert.ok(existsSync(`electron/resources/installer/${frame}.png`), frame);
}
assert.ok(existsSync("electron/resources/installer/icon.ico"));
assert.ok(existsSync("electron/resources/installer/preview-welcome.png"));
assert.ok(existsSync("electron/resources/installer/preview-install.png"));
console.log("ok: NSIS bitmaps are 24-bit at MUI sizes");

const art = readFileSync("scripts/make-installer-art.mjs", "utf8");
assert.match(art, /\[4, 32\]/);
assert.match(art, /\[60, 32\]/);
assert.match(art, /150/);
assert.match(art, /164/);
assert.match(art, /cinem-mark/);
const makeIcon = readFileSync("scripts/make-icon.mjs", "utf8");
assert.match(makeIcon, /make-installer-art/);
const desktopBuild = readFileSync("scripts/desktop-build.mjs", "utf8");
assert.match(desktopBuild, /make-icon\.mjs/);
assert.match(desktopBuild, /CINEM-Pro-Setup\.exe/);
console.log("ok: art generator uses official mark and is on the desktop build path");

const docs = readFileSync("docs/windows-installer-branding.md", "utf8");
assert.match(docs, /installer:art/);
assert.match(docs, /150×57|150x57/);
assert.match(docs, /164×314|164x314/);
assert.match(docs, /cannot play video/i);
assert.match(docs, /customWelcomePage/);
assert.match(docs, /CINEM-Pro-Setup\.exe/);
const assistantDocs = readFileSync("docs/cinem-ai-assistant.md", "utf8");
assert.match(assistantDocs, /windows-installer-branding/);
const workflow = readFileSync(".github/workflows/desktop-windows.yml", "utf8");
assert.match(workflow, /desktop:build:win/);
assert.match(workflow, /CINEM-Pro-Setup\.exe/);
assert.match(workflow, /windows-latest/);
console.log("ok: docs + Windows workflow still produce Setup.exe");

const regen = spawnSync(process.execPath, [path.join("scripts", "make-installer-art.mjs")], {
  encoding: "utf8",
});
assert.equal(regen.status, 0, regen.stderr || regen.stdout);
assert.deepEqual(bmpSize("electron/resources/installer/header.bmp"), {
  width: 150,
  height: 57,
  bits: 24,
});
console.log("ok: installer art regenerates");

console.log("Installer branding checks passed.");
