/**
 * Golden regression checks for power pack + MVP wiring (wake, companion, plugins, invites).
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolveGoogleApiKey } from "../apps/cinem-ai-assistant/src/lib/googleApiKey";
import { foundingIncludesAssistant } from "../src/lib/founding-members";
import {
  REFERRAL_BONUS_MONTHS_DEFAULT,
  REFERRAL_INVITER_CAP,
  referralBonusTurns,
} from "../src/lib/referral-invites";

const root = process.cwd();

function read(path: string): string {
  return readFileSync(`${root}/${path}`, "utf8");
}

assert.ok(existsSync("apps/cinem-ai-assistant/src/components/gate/GeminiOnboardingModal.tsx"));
assert.ok(existsSync("apps/cinem-ai-assistant/src/lib/wakeWord.ts"));
assert.ok(existsSync("electron/wake-word.cjs"));
assert.ok(existsSync("apps/cinem-ai-assistant/src/lib/companionCloud.ts"));
assert.ok(existsSync("apps/cinem-ai-assistant/src/components/mobile/MobileCompanionPanel.tsx"));
assert.ok(!existsSync("apps/cinem-ai-assistant/src/components/mobile/MobileCompanionStub.tsx"));
assert.ok(existsSync("apps/cinem-ai-assistant/src/components/invite/InviteSharePanel.tsx"));
assert.ok(existsSync("src/lib/referral-invites.ts"));
assert.ok(existsSync("src/lib/mobile-companion.ts"));
assert.ok(existsSync("src/server/api/companion/pair.ts"));
assert.ok(existsSync("src/app/companion/pair/page.tsx"));
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
assert.match(settingsModal, /MobileCompanionPanel/);
assert.match(settingsModal, /InviteSharePanel/);

const wakeWord = read("apps/cinem-ai-assistant/src/lib/wakeWord.ts");
assert.match(wakeWord, /setWakeDeepSleep|deepSleep/);
assert.match(wakeWord, /porcupine|web-speech/i);

const pluginPanel = read("apps/cinem-ai-assistant/src/components/marketplace/PluginRegistryPanel.tsx");
assert.match(pluginPanel, /marketplace/);
assert.doesNotMatch(pluginPanel, /Placeholder — coming soon/);

const inviteApi = read("src/server/api/user/invite.ts");
assert.doesNotMatch(inviteApi, /stub\)/);
assert.match(inviteApi, /referralBonusMonths/);

const main = read("electron/main.cjs");
assert.match(main, /showFirstLaunchChooser/);
assert.match(main, /preferred-mode\.json/);
assert.match(main, /cinem:wake-word:start/);
assert.match(main, /wake-word\.cjs/);

const orchestrator = read("apps/cinem-ai-assistant/src/lib/orchestrator.ts");
assert.match(orchestrator, /playOnYouTube|searchYouTubeWithFallback/);

const builder = read("electron/local-builder.cjs");
assert.match(builder, /scaffold|build/i);

assert.equal(resolveGoogleApiKey({ geminiKey: "AIza-test", youtubeKey: "" }), "AIza-test");
assert.equal(resolveGoogleApiKey({ geminiKey: "", youtubeKey: "legacy" }), "legacy");
assert.ok(foundingIncludesAssistant({ assistantFoundingMember: true }));
assert.equal(referralBonusTurns(REFERRAL_BONUS_MONTHS_DEFAULT), 500);
assert.equal(REFERRAL_INVITER_CAP, 50);

const morning = read("apps/cinem-ai-assistant/src/lib/morningProtocol.ts");
assert.match(morning, /compoundingMemory|memoriesForBriefing/);

const schema = read("prisma/schema.prisma");
assert.match(schema, /model InviteRedemption/);
assert.match(schema, /model MobileCompanionPair/);
assert.match(schema, /referralBonusMonths/);

console.log("check-power-pack: OK");
