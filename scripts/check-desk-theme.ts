/**
 * Desk appearance: stored preference, system default, dark product fallback.
 * No database.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  DESK_THEME_STORAGE_KEY,
  isDeskTheme,
  resolveDeskTheme,
} from "../src/lib/desk-theme";

assert.equal(DESK_THEME_STORAGE_KEY, "cinem-desk-theme");
assert.equal(isDeskTheme("light"), true);
assert.equal(isDeskTheme("dark"), true);
assert.equal(isDeskTheme("system"), false);

assert.equal(resolveDeskTheme("light", true), "light");
assert.equal(resolveDeskTheme("dark", false), "dark");
assert.equal(resolveDeskTheme(null, false), "light");
assert.equal(resolveDeskTheme(undefined, true), "dark");
assert.equal(resolveDeskTheme("system", false), "light");
assert.equal(resolveDeskTheme("system", true), "dark");
assert.equal(resolveDeskTheme(null, undefined), "dark");
assert.equal(resolveDeskTheme("nope"), "dark");
console.log("ok: stored Light/Dark wins; unset follows system; unknown defaults dark");

const layout = readFileSync("src/app/layout.tsx", "utf8");
assert.match(layout, /DESK_THEME_STORAGE_KEY/);
assert.match(layout, /enableSystem/);
assert.doesNotMatch(layout, /forcedTheme/);
console.log("ok: ThemeProvider persists and is not forced to dark");

const composer = readFileSync("src/components/desk/chat-composer.tsx", "utf8");
assert.match(composer, /bg-composer/);
assert.match(composer, /bg-composer-send/);
assert.match(composer, /text-composer-send-foreground/);
assert.doesNotMatch(composer, /#eceae4/);
console.log("ok: composer uses theme tokens instead of a hardcoded off-white bar");

const css = readFileSync("src/app/globals.css", "utf8");
assert.match(css, /--composer-send:\s*#3f7a4f/);
assert.match(css, /\.dark\s*\{[\s\S]*--composer:\s*#2f2f2f/);
assert.match(css, /:root\s*\{[\s\S]*--composer:\s*#eceae4/);
console.log("ok: light composer is off-white + green send; dark is charcoal");

const chrome = readFileSync("src/components/desk/desk-chrome.tsx", "utf8");
assert.match(chrome, /DeskThemeToggle/);
assert.match(chrome, /justify-end/);
console.log("ok: desk chrome header hosts the Light/Dark toggle");

console.log("Desk theme checks passed.");
