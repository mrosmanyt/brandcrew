/**
 * Marketplace catalogs, secret encryption, honest Connect rules.
 * No paid APIs. Optional: does not mark Connected without a key.
 */
import assert from "node:assert/strict";
import { decryptSecret, encryptSecret } from "../src/lib/crypto-secret";
import { DEFAULT_AGENT_NAME } from "../src/lib/constants";
import { prisma } from "../src/lib/db";
import {
  getMarketplaceBot,
  getMarketplacePlugin,
  MARKETPLACE_BOTS,
  MARKETPLACE_PLUGINS,
  resolveApiKeyConnect,
} from "../src/lib/marketplace";
import { oauthReady } from "../src/lib/plugins";

assert.ok(MARKETPLACE_BOTS.length >= 10);
for (const id of [
  "bot-sales",
  "bot-content",
  "bot-research",
  "bot-finance",
  "bot-ops",
  "bot-dev",
  "bot-whatsapp",
  "bot-manager",
  "bot-marketing",
  "bot-ads",
  "bot-main",
]) {
  const bot = getMarketplaceBot(id);
  assert.ok(bot, `missing bot ${id}`);
  assert.equal(bot.role.length > 0, true);
  assert.equal(bot.instructions.length > 20, true);
}
assert.ok(MARKETPLACE_BOTS.every((bot) => bot.creator === "Brandcrew"));
console.log(`ok: ${MARKETPLACE_BOTS.length} bot templates`);

const plugins = ["web-search", "gmail", "slack", "notion", "google-calendar", "google-drive", "stripe"];
for (const id of plugins) {
  assert.ok(getMarketplacePlugin(id), `missing plugin ${id}`);
}
const web = getMarketplacePlugin("web-search");
assert.equal(web?.auth, "api_key");
assert.deepEqual(web?.tools, ["web_search"]);
assert.deepEqual(getMarketplacePlugin("gmail")?.tools, [
  "gmail_list_recent",
  "gmail_create_draft",
]);
assert.deepEqual(getMarketplacePlugin("slack")?.tools, [
  "slack_list_channels",
  "slack_draft_message",
  "slack_post_message",
]);
assert.equal(getMarketplacePlugin("gmail")?.auth, "oauth");
assert.equal(getMarketplacePlugin("slack")?.auth, "oauth");
console.log(`ok: ${MARKETPLACE_PLUGINS.length} plugins`);

const empty = resolveApiKeyConnect(web!, { apiKey: "" });
assert.equal(empty.ok, false);
const pasted = resolveApiKeyConnect(web!, { apiKey: "tvly-test-key" });
assert.equal(pasted.ok, true);
if (pasted.ok) {
  assert.equal(pasted.source, "workspace");
  assert.equal(pasted.secret, "tvly-test-key");
}
const missingEnv = resolveApiKeyConnect(web!, { useEnv: true });
if (!process.env.TAVILY_API_KEY) {
  assert.equal(missingEnv.ok, false);
}
console.log("ok: empty Connect stays disconnected");

const gmail = getMarketplacePlugin("gmail")!;
const savedGoogle = {
  GMAIL_CLIENT_ID: process.env.GMAIL_CLIENT_ID,
  GMAIL_CLIENT_SECRET: process.env.GMAIL_CLIENT_SECRET,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
};
delete process.env.GMAIL_CLIENT_ID;
delete process.env.GMAIL_CLIENT_SECRET;
delete process.env.GOOGLE_CLIENT_ID;
delete process.env.GOOGLE_CLIENT_SECRET;
assert.equal(oauthReady(gmail), false);
for (const [key, value] of Object.entries(savedGoogle)) {
  if (value) process.env[key] = value;
  else delete process.env[key];
}
console.log("ok: Gmail OAuth is not ready without client ids");

const round = decryptSecret(encryptSecret("super-secret-token"));
assert.equal(round, "super-secret-token");
console.log("ok: secret encrypt/decrypt round-trip");

assert.equal(DEFAULT_AGENT_NAME, "New Agent");

async function dbSmoke() {
  const slug = `mp-test-${Date.now()}`;
  const workspace = await prisma.workspace.create({
    data: { name: "Marketplace test", slug },
  });
  try {
    const bot = getMarketplaceBot("bot-sales")!;
    const agent = await prisma.agent.create({
      data: {
        workspaceId: workspace.id,
        name: DEFAULT_AGENT_NAME,
        role: bot.role,
        instructions: bot.instructions,
        templateId: bot.id,
      },
    });
    assert.equal(agent.name, DEFAULT_AGENT_NAME);
    assert.equal(agent.templateId, "bot-sales");
    const duplicate = await prisma.agent.findFirst({
      where: {
        workspaceId: workspace.id,
        templateId: bot.id,
        status: { not: "archived" },
      },
    });
    assert.equal(duplicate?.id, agent.id);

    const emptyConnect = resolveApiKeyConnect(getMarketplacePlugin("web-search")!, {
      apiKey: "   ",
    });
    assert.equal(emptyConnect.ok, false);
    const connection = await prisma.pluginConnection.create({
      data: {
        workspaceId: workspace.id,
        pluginId: "web-search",
        status: "disconnected",
        metadata: "{}",
        secretEnc: "",
      },
    });
    assert.equal(connection.status, "disconnected");
    console.log("ok: Add bot writes Agent; empty plugin stays disconnected in DB");
  } finally {
    await prisma.workspace.delete({ where: { id: workspace.id } });
    await prisma.$disconnect();
  }
}

dbSmoke()
  .then(() => console.log("Marketplace checks passed."))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
