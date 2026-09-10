/**
 * Live first Composio tool call. Uses process.env.COMPOSIO_API_KEY only.
 * Prefers Gmail profile when Connected; otherwise a no-auth Hacker News read.
 * Never prints the API key.
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

import assert from "node:assert/strict";
import { composioConfigured, composioMissingHint, runComposioFirstCall } from "../src/lib/composio";

async function main() {
  if (!composioConfigured()) {
    console.error(composioMissingHint());
    process.exit(2);
  }

  const workspaceId = process.env.COMPOSIO_PROBE_WORKSPACE_ID || "phase3-first-call";
  const result = await runComposioFirstCall(workspaceId);

  console.log("configured:", result.configured);
  console.log("ok:", result.ok);
  console.log("toolkit:", result.toolkit);
  console.log("tool:", result.tool);
  console.log("gmailConnected:", result.gmailConnected);
  console.log("logId:", result.logId || "(none returned)");
  console.log("excerpt:", result.excerpt.slice(0, 240));
  if (result.connectHint) console.log("next:", result.connectHint);
  if (result.error) console.log("error:", result.error);

  assert.equal(result.configured, true);
  assert.equal(result.ok, true, result.error || "first tool call failed");
  assert.ok(result.tool, "expected a discovered tool slug");
  assert.ok(result.toolkit === "gmail" || result.toolkit === "hackernews");
  console.log("ok: first Composio tool call returned a provider result");
}

void main();
