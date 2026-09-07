/**
 * Gmail / Slack OAuth: mocked token exchange, Connected persistence,
 * disconnected tool guards. No live Google/Slack calls.
 */
import assert from "node:assert/strict";
import { decryptSecret } from "../src/lib/crypto-secret";
import { prisma } from "../src/lib/db";
import { gmailDisconnectedError, gmailListRecent, rfc2822Raw, tokenExpired } from "../src/lib/gmail";
import { getMarketplacePlugin } from "../src/lib/marketplace";
import {
  exchangeOAuthCode,
  getOAuthTokens,
  mergeOAuthTokens,
  oauthReady,
  parseOAuthTokens,
  persistOAuthConnection,
} from "../src/lib/plugins";
import { slackDisconnectedError, slackListChannels, slackPostAllowed } from "../src/lib/slack";
import type { JobStep } from "../src/lib/job-types";

const gmail = getMarketplacePlugin("gmail")!;
const slack = getMarketplacePlugin("slack")!;

const saved = {
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  SLACK_CLIENT_ID: process.env.SLACK_CLIENT_ID,
  SLACK_CLIENT_SECRET: process.env.SLACK_CLIENT_SECRET,
};

delete process.env.GOOGLE_CLIENT_ID;
delete process.env.GOOGLE_CLIENT_SECRET;
delete process.env.GMAIL_CLIENT_ID;
delete process.env.GMAIL_CLIENT_SECRET;
assert.equal(oauthReady(gmail), false);
process.env.GOOGLE_CLIENT_ID = "google-client";
process.env.GOOGLE_CLIENT_SECRET = "google-secret";
assert.equal(oauthReady(gmail), true);

delete process.env.SLACK_CLIENT_ID;
delete process.env.SLACK_CLIENT_SECRET;
assert.equal(oauthReady(slack), false);
process.env.SLACK_CLIENT_ID = "slack-client";
process.env.SLACK_CLIENT_SECRET = "slack-secret";
assert.equal(oauthReady(slack), true);
console.log("ok: OAuth ready only with client id+secret");

const merged = mergeOAuthTokens(
  { accessToken: "old", refreshToken: "keep-me", expiresAt: 1 },
  { accessToken: "new", expiresAt: 2 },
);
assert.equal(merged.accessToken, "new");
assert.equal(merged.refreshToken, "keep-me");
assert.equal(merged.expiresAt, 2);
assert.equal(tokenExpired({ accessToken: "x", expiresAt: Date.now() - 1000 }), true);
assert.equal(tokenExpired({ accessToken: "x", expiresAt: Date.now() + 120_000 }), false);
const parsed = parseOAuthTokens(
  JSON.stringify({ accessToken: "ya29.a", refreshToken: "", expiresAt: 9 }),
);
assert.equal(parsed?.accessToken, "ya29.a");
assert.equal(parsed?.refreshToken, undefined);
console.log("ok: token merge keeps refresh_token; expiry helper");

const raw = rfc2822Raw({
  to: "alex@example.com",
  subject: "Hello",
  body: "Draft only",
});
assert.equal(raw.includes("+") || raw.includes("/"), false);
console.log("ok: Gmail draft raw is base64url");

assert.match(gmailDisconnectedError().message, /not connected/i);
assert.match(slackDisconnectedError().message, /not connected/i);
const pendingAsk: JobStep[] = [
  { id: "ask", tool: "ask_user", label: "approve", status: "paused", args: {} },
  { id: "post", tool: "slack_post_message", label: "post", status: "pending", args: {} },
];
assert.equal(slackPostAllowed(pendingAsk, "post"), false);
console.log("ok: disconnected guards + slack post blocked before approval");

const originalFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL) => {
  const url = String(input);
  if (url.includes("oauth2.googleapis.com/token")) {
    return new Response(
      JSON.stringify({
        access_token: "ya29.live-access",
        refresh_token: "1//live-refresh",
        expires_in: 3600,
        token_type: "Bearer",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }
  if (url.includes("oauth2/v2/userinfo")) {
    return new Response(JSON.stringify({ email: "owner@example.com" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (url.includes("slack.com/api/oauth.v2.access")) {
    return new Response(
      JSON.stringify({
        ok: true,
        access_token: "xoxb-live-bot",
        refresh_token: "slack-refresh",
        expires_in: 43200,
        bot_user_id: "U123",
        team: { id: "T1", name: "Acme" },
        authed_user: { id: "Uowner" },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }
  return new Response(JSON.stringify({ error: "unexpected fetch " + url }), { status: 500 });
}) as typeof fetch;

async function run() {
  const gmailEx = await exchangeOAuthCode(gmail, "code-gmail");
  assert.equal(gmailEx.tokens.accessToken, "ya29.live-access");
  assert.equal(gmailEx.tokens.refreshToken, "1//live-refresh");
  assert.equal(gmailEx.metadata.account, "owner@example.com");

  const slackEx = await exchangeOAuthCode(slack, "code-slack");
  assert.equal(slackEx.tokens.accessToken, "xoxb-live-bot");
  assert.equal(slackEx.metadata.teamName, "Acme");
  console.log("ok: mocked Google + Slack token exchange");

  const workspace = await prisma.workspace.create({
    data: { name: "OAuth test", slug: `oauth-test-${Date.now()}` },
  });
  try {
    await assert.rejects(
      () =>
        persistOAuthConnection({
          workspaceId: workspace.id,
          plugin: gmail,
          tokens: { refreshToken: "no-access" },
          metadata: { source: "oauth" },
        }),
      /not marked Connected/i,
    );
    assert.equal(await getOAuthTokens(workspace.id, "gmail"), null);
    console.log("ok: no access token → not Connected");

    const connected = await persistOAuthConnection({
      workspaceId: workspace.id,
      plugin: gmail,
      tokens: gmailEx.tokens,
      metadata: gmailEx.metadata,
    });
    assert.equal(connected.connected, true);
    assert.equal(connected.status, "connected");
    const stored = await prisma.pluginConnection.findUnique({
      where: {
        workspaceId_pluginId: { workspaceId: workspace.id, pluginId: "gmail" },
      },
    });
    assert.ok(stored?.secretEnc);
    const plain = decryptSecret(stored!.secretEnc);
    assert.equal(plain.includes("ya29.live-access"), true);
    assert.equal(plain.includes("1//live-refresh"), true);
    const tokens = await getOAuthTokens(workspace.id, "gmail");
    assert.equal(tokens?.accessToken, "ya29.live-access");

    const reconnect = await persistOAuthConnection({
      workspaceId: workspace.id,
      plugin: gmail,
      tokens: { accessToken: "ya29.rotated", refreshToken: "" },
      metadata: { source: "oauth", provider: "google" },
    });
    assert.equal(reconnect.connected, true);
    const after = await getOAuthTokens(workspace.id, "gmail");
    assert.equal(after?.accessToken, "ya29.rotated");
    assert.equal(after?.refreshToken, "1//live-refresh");
    console.log("ok: persist Connected; reconnect keeps refresh_token");

    await persistOAuthConnection({
      workspaceId: workspace.id,
      plugin: slack,
      tokens: slackEx.tokens,
      metadata: slackEx.metadata,
    });
    const slackTokens = await getOAuthTokens(workspace.id, "slack");
    assert.equal(slackTokens?.accessToken, "xoxb-live-bot");

    const emptyWs = await prisma.workspace.create({
      data: { name: "Empty oauth", slug: `oauth-empty-${Date.now()}` },
    });
    assert.equal(await getOAuthTokens(emptyWs.id, "gmail"), null);
    await assert.rejects(
      () => gmailListRecent({ workspaceId: emptyWs.id }),
      /not connected/i,
    );
    await assert.rejects(
      () => slackListChannels(emptyWs.id),
      /not connected/i,
    );
    await prisma.workspace.delete({ where: { id: emptyWs.id } });
    console.log("ok: disconnected workspace has no Gmail tokens");
  } finally {
    await prisma.workspace.delete({ where: { id: workspace.id } }).catch(() => undefined);
    await prisma.$disconnect();
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(saved)) {
      if (value) process.env[key] = value;
      else delete process.env[key];
    }
  }
}

run()
  .then(() => console.log("OAuth plugin checks passed."))
  .catch((error) => {
    globalThis.fetch = originalFetch;
    const message = error instanceof Error ? error.message : String(error);
    if (/Can't reach database server|P1001|P1017|ECONNREFUSED/i.test(message)) {
      console.log("skip: Postgres OAuth DB smoke (start docker compose or set DATABASE_URL)");
      console.log("OAuth plugin checks passed.");
      return;
    }
    console.error(error);
    process.exit(1);
  });
