/**
 * Unified assistant UX: updater honesty, World Monitor, Windows icon, globe, chat mic.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { parseWorldMonitorDigest } from "../apps/cinem-ai-assistant/src/lib/world-monitor.ts";

const updater = readFileSync("electron/updater.cjs", "utf8");
assert.match(updater, /ensureAutoUpdater/);
assert.match(updater, /CINEM-Pro-Setup\.exe/);
assert.doesNotMatch(updater, /Updater is not initialized/);
assert.match(readFileSync("electron/main.cjs", "utf8"), /cinem:http-get/);
assert.match(readFileSync("electron/assistant-preload.cjs", "utf8"), /httpGet/);
console.log("ok: updater retries init; no false 'not initialized'");

const wm = readFileSync("apps/cinem-ai-assistant/src/components/center/WorldMonitor.tsx", "utf8");
assert.doesNotMatch(wm, /<iframe/);
assert.match(wm, /fetchHeadlineResult|WORLD_MONITOR/);
assert.match(readFileSync("apps/cinem-ai-assistant/src/lib/news.ts", "utf8"), /fromWorldMonitor|WORLD_MONITOR_DIGEST/);
assert.match(readFileSync("apps/cinem-ai-assistant/src/store/useSettingsStore.ts", "utf8"), /worldMonitorKey/);
const parsed = parseWorldMonitorDigest({
  categories: {
    geopolitics: {
      items: [{ title: "Hormuz shipping pause", source: "AP", link: "https://example.com", publishedAt: 1 }],
    },
  },
});
assert.equal(parsed[0]?.title, "Hormuz shipping pause");
assert.ok(existsSync("docs/world-monitor.md"));
console.log("ok: World Monitor native feed + digest parse");

const hub = readFileSync("apps/cinem-ai-assistant/src/components/center/IntelligenceHub.tsx", "utf8");
assert.match(hub, /pointermove/);
assert.match(hub, /attract/);
assert.match(hub, /CINEM/);
assert.doesNotMatch(hub, /GEMINI\s*\/\s*OLLAMA/);
console.log("ok: hub globe mouse attract");

const chat = readFileSync("apps/cinem-ai-assistant/src/components/right/ChatPanel.tsx", "utf8");
assert.match(chat, /toggleVoiceCommand/);
assert.match(chat, /<Mic/);
assert.match(chat, /Message Cinem AI Assistant/);
assert.match(readFileSync("apps/cinem-ai-assistant/src/lib/voice-command.ts", "utf8"), /startListening/);
console.log("ok: chat bubbles + mic");

const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
  version: string;
  build: { win?: { icon?: string }; extraResources?: Array<{ filter?: string[] }>; asarUnpack?: string[] };
};
assert.equal(pkg.version, "0.3.2");
assert.match(pkg.build.win?.icon ?? "", /icon\.ico$/);
assert.ok(pkg.build.extraResources?.some((item) => item.filter?.includes("icon.ico")));
assert.ok((pkg.build.asarUnpack || []).some((g) => g.includes("electron-updater")));
assert.match(readFileSync("electron/main.cjs", "utf8"), /icon\.ico/);
assert.match(readFileSync("scripts/make-icon.mjs", "utf8"), /icon\.ico/);
console.log("ok: Windows CINEM .ico + 0.3.2");

console.log("Assistant UX checks passed.");
