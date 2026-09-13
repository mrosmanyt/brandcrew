/**
 * Honest data-processing summary for agencies (GDPR Art. 13/28 hooks).
 * Not legal advice. DPA template lives at /dpa.
 */

export type ProcessingLocation = "device" | "server" | "processor";

export type ProcessingRow = {
  category: string;
  location: ProcessingLocation;
  leavesDevice: boolean;
  purpose: string;
  examples: string;
};

export const DATA_PROCESSING_ROWS: ProcessingRow[] = [
  {
    category: "Account",
    location: "server",
    leavesDevice: true,
    purpose: "Sign-in and workspace membership",
    examples: "Name, email, password hash or Google sub. Web session JWT in an HttpOnly cookie. Desktop/Android store a hashed refresh token on device; the Chrome extension stores a device token after Sign in with CINEM.",
  },
  {
    category: "Workspace content",
    location: "server",
    leavesDevice: true,
    purpose: "Agents, jobs, Brand Kit, artifacts, learning memory",
    examples: "Stored in Postgres per workspace. Client desks do not share Brand Kit or memory with the house desk.",
  },
  {
    category: "On-device browse",
    location: "device",
    leavesDevice: false,
    purpose: "Chrome CDP via the MV3 extension / native host",
    examples:
      "Page interaction stays on the paired machine when On-device Chrome is used. The server receives tool results the job needs, not your full browser profile.",
  },
  {
    category: "Cloud browse fallback",
    location: "server",
    leavesDevice: true,
    purpose: "Public-page fetch when no device is paired",
    examples: "Playwright/desktop or serverless fetch of allowlisted URLs. No fake success on Vercel without Chrome.",
  },
  {
    category: "Plugin secrets",
    location: "server",
    leavesDevice: true,
    purpose: "Gmail, Slack, Composio, and pasted API keys",
    examples: "Encrypted at rest. Never returned to the browser. COMPOSIO_API_KEY is read from the host environment only.",
  },
  {
    category: "Model inference",
    location: "processor",
    leavesDevice: true,
    purpose: "Draft generation when server LLM keys are set",
    examples: "Job text is sent to the selected provider (OpenAI, Anthropic, Google, or xAI). Keys stay on the server.",
  },
  {
    category: "Optional analytics",
    location: "processor",
    leavesDevice: true,
    purpose: "Product analytics only after cookie accept",
    examples: "Scripts load only when an analytics env var is set and the banner choice is Accept. Essential-only skips them.",
  },
  {
    category: "Billing",
    location: "processor",
    leavesDevice: true,
    purpose: "Checkout and plan entitlements",
    examples:
      "Whop (preferred) or Stripe. Workspace plan, seats, and token/credit caps. No unlimited plan. A Whop pixel (t.whop.tw, business biz_VrtL8S4duREQg4) loads in the site head on every page for checkout attribution — not optional product analytics.",
  },
];

export const GDPR_SUBPROCESSORS = [
  { name: "Vercel", role: "Hosting / application", region: "As configured on the Vercel project" },
  { name: "Neon or equivalent Postgres", role: "Primary database", region: "As configured by DATABASE_URL" },
  { name: "OpenAI / Anthropic / Google / xAI", role: "Optional LLM processors", region: "Provider default" },
  { name: "Composio", role: "Optional integration broker", region: "Composio (when COMPOSIO_API_KEY is set)" },
  { name: "Google / Slack / other OAuth apps", role: "Connected plugins you authorize", region: "Provider default" },
  { name: "Whop / Stripe", role: "Paid plan checkout", region: "Provider default" },
] as const;

export const DPA_CONTACT_NOTE =
  "Agency buyers can send the /dpa template to CINEM for countersignature. This in-product text is a starting template, not a signed agreement and not legal advice.";
