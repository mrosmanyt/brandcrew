/**
 * Golden regression checks for power pack + founding + BYOK ship.
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolveGoogleApiKey } from "../apps/cinem-ai-assistant/src/lib/googleApiKey";
import { foundingIncludesAssistant } from "../src/lib/founding-members";

const root = process.cwd();

function read(path: string): string {
  return readFileSync(`${root}/${path}`, "utf8");
}

assert.ok(existsSync("apps/cinem-ai-assistant/src/components/gate/GeminiOnboardingModal.tsx"));
assert.ok(existsSync("apps/cinem-ai-assistant/src/lib/wakeWord.ts"));
assert.ok(existsSync("apps/cinem-ai-assistant/src/lib/creatorOs.ts"));
assert.ok(existsSync("apps/cinem-ai-assistant/src/lib/compoundingMemory.ts"));
assert.ok(existsSync("apps/cinem-ai-assistant/src/components/creator/CreatorOsPanel.tsx"));
assert.ok(existsSync("apps/cinem-ai-assistant/src/components/team/TeamHandoffPanel.tsx"));
assert.ok(existsSync("apps/cinem-ai-assistant/src/components/byok/ByokDashboardTab.tsx"));
assert.ok(existsSync("electron/mode-chooser.html"));
assert.ok(existsSync("src/lib/founding-members.ts"));
assert.ok(existsSync("src/lib/user-provider-keys.ts"));
assert.ok(existsSync("src/server/api/founding/spots.ts"));
assert.ok(existsSync("src/server/api/user/byok.ts"));

const settingsModal = read("apps/cinem-ai-assistant/src/components/settings/SettingsModal.tsx");
assert.doesNotMatch(settingsModal, /YouTube API Key/);
assert.match(settingsModal, /YouTube play\/search uses this same Gemini key/);
assert.match(settingsModal, /ByokDashboardTab/);
assert.match(settingsModal, /Hey Cinem/);

const main = read("electron/main.cjs");
assert.match(main, /showFirstLaunchChooser/);
assert.match(main, /preferred-mode\.json/);

const orchestrator = read("apps/cinem-ai-assistant/src/lib/orchestrator.ts");
assert.match(orchestrator, /playOnYouTube|searchYouTubeWithFallback/);

const builder = read("electron/local-builder.cjs");
assert.match(builder, /scaffold|build/i);

assert.equal(resolveGoogleApiKey({ geminiKey: "AIza-test", youtubeKey: "" }), "AIza-test");
assert.equal(resolveGoogleApiKey({ geminiKey: "", youtubeKey: "legacy" }), "legacy");
assert.ok(foundingIncludesAssistant({ assistantFoundingMember: true }));

const morning = read("apps/cinem-ai-assistant/src/lib/morningProtocol.ts");
assert.match(morning, /compoundingMemory|memoriesForBriefing/);

console.log("check-power-pack: OK");
