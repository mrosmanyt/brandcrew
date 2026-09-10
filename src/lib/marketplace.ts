import { DEFAULT_AGENT_NAME } from "@/lib/constants";
import { COMPOSIO_AGENCY_TOOLKITS } from "@/lib/composio-catalog";
import { TEAM_LAUNCH_ROLES } from "@/lib/team-launch";

export const MARKETPLACE_BOT_CATEGORIES = [
  "All",
  "Featured",
  "From CINEM Pro",
  "Engineering",
  "Sales",
  "Marketing",
  "Design",
  "Personal",
  "Finance",
  "Ops",
  "Customer Support",
  "Data & Analytics",
] as const;

export type MarketplaceBotCategory =
  (typeof MARKETPLACE_BOT_CATEGORIES)[number];

const FEATURED_BOT_IDS = new Set([
  "bot-sales",
  "bot-content",
  "bot-research",
  "bot-marketing",
  "bot-whatsapp",
  "bot-main",
  "bot-website",
  "bot-app",
]);

const BOT_COLORS: Record<string, string> = {
  "bot-main": "#c45c26",
  "bot-research": "#3f6b58",
  "bot-manager": "#1f3d4c",
  "bot-ads": "#b45309",
  "bot-sales": "#9f1239",
  "bot-marketing": "#6d28d9",
  "bot-finance": "#0f766e",
  "bot-whatsapp": "#15803d",
  "bot-ops": "#57534e",
  "bot-dev": "#1d4ed8",
  "bot-content": "#be185d",
  "bot-support": "#0369a1",
  "bot-website": "#0ea5e9",
  "bot-app": "#7c3aed",
};

export type MarketplaceBot = {
  id: string;
  name: string;
  role: string;
  creator: string;
  description: string;
  instructions: string;
  starter: string;
  category: string;
  featured: boolean;
  color: string;
};

const BUILDER_BOTS: MarketplaceBot[] = [
  {
    id: "bot-website",
    name: "Website",
    role: "Website",
    creator: "CINEM Pro",
    description:
      "One-click landing pages from the Brand Kit. Preview in the desk. Does not publish.",
    instructions:
      "You are the Website Builder. Read the Brand Kit, then write a complete HTML document (CSS in a style tag, no external scripts). Do not publish or invent a live URL. Last step is ask_user.",
    starter: "Build a one-page branded website from the Brand Kit. Do not publish.",
    category: "Engineering",
    featured: true,
    color: "#0ea5e9",
  },
  {
    id: "bot-app",
    name: "App",
    role: "App",
    creator: "CINEM Pro",
    description:
      "Small branded web apps with an in-desk preview. No Replit login required.",
    instructions:
      "You are the App Builder. Return a complete HTML mini-app the desk can preview in an iframe. No Replit, no deploy, no login. Last step is ask_user.",
    starter: "Build a small branded web app from the Brand Kit. Preview only.",
    category: "Engineering",
    featured: true,
    color: "#7c3aed",
  },
];

export const MARKETPLACE_BOTS: MarketplaceBot[] = [
  ...TEAM_LAUNCH_ROLES.map((row) => ({
    id: row.id,
    name: row.role,
    role: row.role,
    creator: "CINEM Pro",
    description: row.blurb,
    instructions: row.instructions,
    starter: row.starter,
    category: row.category,
    featured: FEATURED_BOT_IDS.has(row.id),
    color: BOT_COLORS[row.id] || "#c45c26",
  })),
  ...BUILDER_BOTS,
];

export function getMarketplaceBot(id: string) {
  return MARKETPLACE_BOTS.find((bot) => bot.id === id) ?? null;
}

export function newAgentFromTemplate(templateId: string) {
  const bot = getMarketplaceBot(templateId);
  if (!bot) return null;
  return {
    templateId: bot.id,
    name: DEFAULT_AGENT_NAME,
    role: bot.role,
    instructions: bot.instructions,
    starter: bot.starter,
  };
}

export const PLUGIN_CATEGORIES = [
  "All",
  "Featured",
  "Agent Orchestration",
  "Canvas",
  "Customer Support",
  "Data & Analytics",
  "CRM",
  "Outreach",
  "SEO",
  "Productivity",
  "Billing",
  "Engineering",
] as const;

export type PluginAuth = "api_key" | "oauth" | "composio";

export type PluginDef = {
  id: string;
  name: string;
  description: string;
  category: string;
  featured: boolean;
  auth: PluginAuth;
  oauthProvider?: "google" | "slack" | "notion" | "composio";
  scopes?: string[];
  secretLabel?: string;
  envKeys: string[];
  docsUrl?: string;
  tools: string[];
  letter: string;
  color: string;
  composioSlug?: string;
  probeTool?: string;
};

export const GMAIL_OAUTH_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.compose",
] as const;

export const SLACK_BOT_SCOPES = [
  "channels:read",
  "groups:read",
  "chat:write",
] as const;

export const MARKETPLACE_PLUGINS: PluginDef[] = [
  {
    id: "web-search",
    name: "Web Search",
    description: "Search the public web via Tavily. Jobs can call web_search when Connected.",
    category: "Data & Analytics",
    featured: true,
    auth: "api_key",
    secretLabel: "Tavily API key",
    envKeys: ["TAVILY_API_KEY"],
    docsUrl: "https://docs.tavily.com/documentation/api-reference/endpoint/search",
    tools: ["web_search"],
    letter: "W",
    color: "#1d4ed8",
  },
  {
    id: "gmail",
    name: "Gmail",
    description:
      "List recent mail and create drafts. OAuth — Connected only after a real Google token exchange. Never sends.",
    category: "Customer Support",
    featured: true,
    auth: "oauth",
    oauthProvider: "google",
    scopes: [...GMAIL_OAUTH_SCOPES],
    envKeys: ["GMAIL_CLIENT_ID", "GMAIL_CLIENT_SECRET", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
    tools: ["gmail_list_recent", "gmail_create_draft"],
    letter: "G",
    color: "#ea4335",
  },
  {
    id: "whatsapp",
    name: "WhatsApp",
    description:
      "Draft-only WhatsApp replies. Connect with a Twilio Auth Token if you have one — Connected never means send. Without Twilio, this plugin stays disconnected and playbooks still draft locally.",
    category: "Customer Support",
    featured: true,
    auth: "api_key",
    secretLabel: "Twilio Auth Token",
    envKeys: ["TWILIO_AUTH_TOKEN", "TWILIO_ACCOUNT_SID"],
    docsUrl: "https://www.twilio.com/docs/whatsapp",
    tools: [],
    letter: "WA",
    color: "#25d366",
  },
  {
    id: "slack",
    name: "Slack",
    description:
      "List channels and draft posts. chat.postMessage runs only after an ask_user approval step. Connected only after oauth.v2.access.",
    category: "Customer Support",
    featured: true,
    auth: "oauth",
    oauthProvider: "slack",
    scopes: [...SLACK_BOT_SCOPES],
    envKeys: ["SLACK_CLIENT_ID", "SLACK_CLIENT_SECRET"],
    tools: ["slack_list_channels", "slack_draft_message", "slack_post_message"],
    letter: "S",
    color: "#4a154b",
  },
  {
    id: "notion",
    name: "Notion",
    description: "Connect a Notion workspace. Tokens are stored encrypted; CINEM Pro does not invent page content.",
    category: "Canvas",
    featured: true,
    auth: "oauth",
    oauthProvider: "notion",
    envKeys: ["NOTION_CLIENT_ID", "NOTION_CLIENT_SECRET"],
    tools: [],
    letter: "N",
    color: "#111111",
  },
  {
    id: "google-calendar",
    name: "Google Calendar",
    description: "Search events. Does not create or send calendar invites until you approve outside CINEM Pro.",
    category: "Productivity",
    featured: true,
    auth: "oauth",
    oauthProvider: "google",
    scopes: ["https://www.googleapis.com/auth/calendar.readonly"],
    envKeys: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
    tools: [],
    letter: "C",
    color: "#0b8043",
  },
  {
    id: "google-drive",
    name: "Google Drive",
    description: "Read file metadata after OAuth. No silent uploads.",
    category: "Productivity",
    featured: true,
    auth: "oauth",
    oauthProvider: "google",
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
    envKeys: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
    tools: [],
    letter: "D",
    color: "#188038",
  },
  {
    id: "stripe",
    name: "Stripe",
    description: "Store a restricted Stripe key for this workspace. CINEM Pro never spends or creates charges.",
    category: "Billing",
    featured: false,
    auth: "api_key",
    secretLabel: "Stripe secret key",
    envKeys: ["STRIPE_SECRET_KEY"],
    docsUrl: "https://docs.stripe.com/keys",
    tools: [],
    letter: "$",
    color: "#635bff",
  },
  {
    id: "github",
    name: "GitHub",
    description: "Personal access token for repo metadata. No commits, deploys, or secret scans from the desk.",
    category: "Engineering",
    featured: false,
    auth: "api_key",
    secretLabel: "GitHub personal access token",
    envKeys: ["GITHUB_TOKEN"],
    tools: [],
    letter: "GH",
    color: "#24292f",
  },
  ...COMPOSIO_AGENCY_TOOLKITS.map(
    (row): PluginDef => ({
      id: row.id,
      name: row.name,
      description: row.description,
      category: row.category,
      featured: row.featured,
      auth: "composio",
      oauthProvider: "composio",
      secretLabel: row.auth === "api_key" ? `${row.name} API key` : undefined,
      envKeys: ["COMPOSIO_API_KEY"],
      docsUrl: row.docsUrl,
      tools: ["composio_execute"],
      letter: row.letter,
      color: row.color,
      composioSlug: row.slug,
      probeTool: row.probeTool,
    }),
  ),
];

export function getMarketplacePlugin(id: string) {
  return MARKETPLACE_PLUGINS.find((plugin) => plugin.id === id) ?? null;
}

export type ApiKeyConnectInput = {
  apiKey?: string;
  useEnv?: boolean;
};

export type ApiKeyConnectResult =
  | { ok: true; source: "workspace" | "env"; secret: string }
  | { ok: false; error: string };

export function envValuePresent(keys: string[]) {
  return keys.some((key) => Boolean(process.env[key]?.trim()));
}

export function firstEnvValue(keys: string[]) {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return "";
}

/** Empty key + missing env → not connected. Never invent a Connected state. */
export function resolveApiKeyConnect(
  plugin: PluginDef,
  input: ApiKeyConnectInput,
): ApiKeyConnectResult {
  if (plugin.auth !== "api_key") {
    return {
      ok: false,
      error:
        plugin.auth === "composio"
          ? "This connector uses Composio. Empty Connect stays disconnected."
          : "This plugin uses OAuth, not an API key form.",
    };
  }
  const pasted = input.apiKey?.trim() || "";
  if (pasted) {
    return { ok: true, source: "workspace", secret: pasted };
  }
  if (input.useEnv) {
    const fromEnv = firstEnvValue(plugin.envKeys);
    if (!fromEnv) {
      return {
        ok: false,
        error: `${plugin.envKeys.join(" or ")} is not set on the server. Paste a key or add the env var.`,
      };
    }
    return { ok: true, source: "env", secret: "" };
  }
  return {
    ok: false,
    error: `Paste a ${plugin.secretLabel || "API key"} or use the documented server env var. Connect cannot be empty.`,
  };
}
