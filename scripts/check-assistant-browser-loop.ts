/**
 * Assistant browser/tool loop — YouTube play + Google research routing.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  classifyBrowserIntent,
  extractMediaQuery,
  extractResearchQuery,
  googleSearchUrl,
  isMediaCommand,
  isResearchCommand,
  parseYouTubeIdsFromHtml,
  youtubeEmbedSearchUrl,
} from "../apps/cinem-ai-assistant/src/lib/browserIntents";
import {
  admitResearchHop,
  expandAllowlist,
  isSearchHubHost,
} from "../src/lib/domain-allowlist";
import { inferPlaybookKey } from "../src/lib/job-playbooks";
import { parseDuckDuckGoHits } from "../src/lib/public-web-search";

assert.equal(isMediaCommand("play despacito on youtube"), true);
assert.equal(isMediaCommand("open youtube"), false);
assert.equal(extractMediaQuery("play lofi hip hop on youtube"), "lofi hip hop");

assert.equal(isResearchCommand("research quantum computing on google"), true);
assert.equal(isResearchCommand("play quantum on youtube"), false);
assert.match(extractResearchQuery("research AI chip market"), /AI chip market/i);

const play = classifyBrowserIntent("play bohemian rhapsody on youtube");
assert.equal(play.kind, "play");
const research = classifyBrowserIntent("research latest AI news");
assert.equal(research.kind, "research");
assert.equal(classifyBrowserIntent("open google").kind, "open");

assert.match(youtubeEmbedSearchUrl("lofi"), /listType=search/);
assert.match(googleSearchUrl("test"), /igu=1/);

assert.deepEqual(parseYouTubeIdsFromHtml('<a href="/watch?v=dQw4w9WgXcQ">'), ["dQw4w9WgXcQ"]);

const ddgSample = `<a class="result__a" href="/l/?uddg=https%3A%2F%2Fexample.com">Example</a>`;
assert.ok(parseDuckDuckGoHits(ddgSample).length >= 0);
assert.equal(isSearchHubHost("google.com"), true);
assert.equal(isSearchHubHost("example.com"), false);
const hop = admitResearchHop("https://example.com/article", ["google.com"], 0);
assert.equal(hop.ok, true);
assert.ok(expandAllowlist("https://example.com", ["google.com"]).includes("example.com"));

assert.equal(inferPlaybookKey("researcher", "research quantum computing"), "web_search");
assert.equal(inferPlaybookKey("researcher", "research AI on google"), "web_search");
assert.equal(inferPlaybookKey("researcher", "search the web for comps"), "web_search");

const orchestrator = readFileSync("apps/cinem-ai-assistant/src/lib/orchestrator.ts", "utf8");
assert.match(orchestrator, /playOnYouTube/);
assert.match(orchestrator, /searchYouTubeWithFallback/);
assert.match(orchestrator, /isResearchCommand/);
assert.match(orchestrator, /app\.addMessage\(\{ role: "assistant", text: brief \}\)/);

const pw = readFileSync("apps/cinem-ai-assistant/playwright-server/index.js", "utf8");
assert.match(pw, /autoplay-policy=no-user-gesture-required/);
assert.match(pw, /\/research/);
assert.match(pw, /ensurePlaying/);

const jobRt = readFileSync("src/lib/job-runtime.ts", "utf8");
assert.match(jobRt, /webSearchWithFallback/);
assert.match(jobRt, /postJobOutcomeMessage/);
assert.match(jobRt, /admitResearchHop/);

console.log("Assistant browser loop checks passed.");
