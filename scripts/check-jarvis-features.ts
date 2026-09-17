/**
 * Regression checks for JARVIS-style assistant capabilities.
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { parseWeatherQuery, isWeatherCommand } from "../apps/cinem-ai-assistant/src/lib/weather";
import { parseReminderCreate } from "../apps/cinem-ai-assistant/src/lib/reminders";
import { parseYouTubeControl } from "../apps/cinem-ai-assistant/src/lib/browserIntents";
import { ASSISTANT_TOOLS } from "../apps/cinem-ai-assistant/src/lib/toolRegistry";
import { isImageGenCommand, parseImageGenPrompt } from "../src/lib/image-generation-pure";

const root = process.cwd();

function read(path: string): string {
  return readFileSync(`${root}/${path}`, "utf8");
}

assert.ok(existsSync("apps/cinem-ai-assistant/src/lib/deepgramVoice.ts"));
assert.ok(existsSync("apps/cinem-ai-assistant/src/lib/toolRegistry.ts"));
assert.ok(existsSync("apps/cinem-ai-assistant/src/lib/multiModeSearch.ts"));
assert.ok(existsSync("apps/cinem-ai-assistant/src/lib/weather.ts"));
assert.ok(existsSync("apps/cinem-ai-assistant/src/lib/reminders.ts"));
assert.ok(existsSync("apps/cinem-ai-assistant/src/lib/instantAck.ts"));
assert.ok(existsSync("apps/cinem-ai-assistant/src/lib/sessionBriefing.ts"));

const orchestrator = read("apps/cinem-ai-assistant/src/lib/orchestrator.ts");
assert.match(orchestrator, /toolCatalogForPrompt/);
assert.match(orchestrator, /runMultiModeSearch/);
assert.match(orchestrator, /fetchWeather/);
assert.match(orchestrator, /createReminder/);
assert.match(orchestrator, /postInstantAck/);
assert.match(orchestrator, /parseYouTubeControl/);
assert.match(orchestrator, /generateImageViaCloud/);

const voice = read("apps/cinem-ai-assistant/src/lib/voice.ts");
assert.match(voice, /deepgramTranscribe/);
assert.match(voice, /deepgramSpeak/);

const dgVoice = read("apps/cinem-ai-assistant/src/lib/deepgramVoice.ts");
assert.match(dgVoice, /deepgramSpeak/);
assert.match(dgVoice, /listDeepgramVoices/);

const dgCatalog = read("apps/cinem-ai-assistant/src/lib/deepgram-voices.ts");
assert.match(dgCatalog, /aura-2-thalia-en/);
assert.match(dgCatalog, /aura-zeus-en/);

const settingsModal = read("apps/cinem-ai-assistant/src/components/settings/SettingsModal.tsx");
assert.match(settingsModal, /DeepgramVoicePicker/);
assert.match(settingsModal, /deepgramVoiceId/);

const settingsStore = read("apps/cinem-ai-assistant/src/store/useSettingsStore.ts");
assert.match(settingsStore, /deepgramVoiceId/);

const pw = read("apps/cinem-ai-assistant/playwright-server/index.js");
assert.match(pw, /youtube\/control/);

const env = read("apps/cinem-ai-assistant/.env.example");
assert.match(env, /DEEPGRAM_API_KEY/);

assert.match(read("apps/cinem-ai-assistant/src/lib/multiModeSearch.ts"), /export function parseMultiModeSearch/);
assert.match(read("apps/cinem-ai-assistant/src/lib/multiModeSearch.ts"), /mode: "news"/);

assert.equal(parseWeatherQuery("weather in London"), "London");
assert.ok(isWeatherCommand("what's the forecast for Paris"));

const rem = parseReminderCreate("remind me in 5 minutes to stand up");
assert.ok(rem && rem.text.includes("stand"));

assert.equal(parseYouTubeControl("pause youtube"), "pause");
assert.equal(parseYouTubeControl("next video"), "next");

assert.ok(ASSISTANT_TOOLS.length >= 10);
assert.ok(ASSISTANT_TOOLS.some((t) => t.id === "generate_image"));

assert.equal(parseImageGenPrompt("draw an image of a lighthouse"), "a lighthouse");
assert.ok(isImageGenCommand("generate image of neon city"));

console.log("check-jarvis-features: OK");
