/**
 * Self-describing assistant capabilities — injected into routing so the
 * orchestrator knows what Cinem can do without guessing.
 */
export type AssistantTool = {
  id: string;
  name: string;
  triggers: string[];
  description: string;
  requires?: string;
  limits?: string;
};

export const ASSISTANT_TOOLS: AssistantTool[] = [
  {
    id: "voice",
    name: "Voice mode",
    triggers: ["mic", "speak", "listen"],
    description: "Push-to-talk STT → assistant reply → TTS (Deepgram / Whisper / browser STT; Fish / ElevenLabs / Neural TTS).",
    requires: "Microphone; optional DEEPGRAM_API_KEY or ElevenLabs key in Settings → Voice",
  },
  {
    id: "memory",
    name: "Persistent memory",
    triggers: ["remember that", "what do you know about me"],
    description: "Stores user facts locally; recalls in prompts. Manage in Settings → Memory.",
  },
  {
    id: "search_news",
    name: "News search",
    triggers: ["news about", "latest news", "headlines"],
    description: "Multi-mode web search — news intent with headlines + chat brief.",
  },
  {
    id: "search_research",
    name: "Research",
    triggers: ["research", "look up on google"],
    description: "Deep research with public web + optional Playwright sidecar; answer in chat.",
    requires: "Playwright sidecar on :7878 for live Google tabs",
  },
  {
    id: "search_price",
    name: "Price lookup",
    triggers: ["price of", "how much is", "cost of"],
    description: "Price-focused search with comparison hints in chat.",
  },
  {
    id: "search_compare",
    name: "Compare",
    triggers: ["compare", "vs", "versus"],
    description: "Side-by-side comparison brief from public sources.",
  },
  {
    id: "youtube",
    name: "YouTube control",
    triggers: ["play on youtube", "pause youtube", "next video"],
    description: "Search/play in Chromium sidecar or in-app player; pause/next when player is active.",
    requires: "Playwright sidecar or in-app player tab",
  },
  {
    id: "weather",
    name: "Weather",
    triggers: ["weather in", "forecast for", "temperature in"],
    description: "Current conditions + short forecast for a city (Open-Meteo, no key).",
  },
  {
    id: "reminders",
    name: "Reminders",
    triggers: ["remind me", "list reminders", "cancel reminder"],
    description: "Schedule local reminders with desktop notifications.",
    limits: "Browser/Electron notifications; not OS Task Scheduler yet",
  },
  {
    id: "briefing",
    name: "Morning / session briefing",
    triggers: ["morning briefing", "daily briefing"],
    description: "Proactive greeting with time, optional headlines, and system snapshot.",
  },
  {
    id: "browser",
    name: "Browser open",
    triggers: ["open google", "open github"],
    description: "Opens URLs in task window or system browser with visible status.",
  },
  {
    id: "agents",
    name: "Sub-agents",
    triggers: ["security scan", "organize downloads"],
    description: "15 specialized agents (research, security, local files, email, …).",
  },
];

/** Compact catalog for LLM routing prompts. */
export function toolCatalogForPrompt(): string {
  return ASSISTANT_TOOLS.map(
    (t) =>
      `- ${t.id}: ${t.name} — ${t.description}` +
      (t.requires ? ` [needs: ${t.requires}]` : "") +
      (t.limits ? ` [limit: ${t.limits}]` : ""),
  ).join("\n");
}

export function findTool(id: string): AssistantTool | undefined {
  return ASSISTANT_TOOLS.find((t) => t.id === id);
}
