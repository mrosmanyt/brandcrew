/** The 15 Cinem AI Assistant sub-agents (exact names & roles per spec). */
/** active = enabled · processing = currently working · standby = idle/disabled */
export type AgentStatus = "active" | "standby" | "processing";

/** Distinct voice identity so the user can recognize WHO is speaking. */
export interface AgentVoice {
  /** ElevenLabs premade voice id (primary TTS). */
  elevenVoiceId: string;
  /** Optional Piper voice model override (fallback TTS). */
  piperVoice?: string;
  /** Short description of the voice personality (shown in UI tooltips). */
  personality: string;
}

export interface AgentDef {
  id: string;
  name: string;
  /** Unique, strong English codename — spoken first in every announcement. */
  codename: string;
  role: string;
  status: AgentStatus;
  /** What the agent says right after "…is activated, Sir." */
  tagline: string;
  voice: AgentVoice;
  /** User-built agent (Custom Skills system). */
  custom?: boolean;
  /** Custom agents only: their LLM system prompt (how they think). */
  prompt?: string;
}

/** CEO / Main Orchestrator — "SAM" (deep, confident command voice). */
export const CEO = {
  id: "ceo",
  name: "Main Orchestrator",
  codename: "SAM",
  tagline: "Coordinating the team.",
  voice: {
    elevenVoiceId: "pNInz6obpgDQGcFmaJgB", // Adam — deep, confident
    personality: "Deep, calm, in command",
  } satisfies AgentVoice,
} as const;

export const AGENTS: AgentDef[] = [
  {
    id: "security", name: "Security Agent", codename: "DAVID",
    role: "Monitors and protects the entire system security.", status: "active",
    tagline: "Scanning the system for threats.",
    voice: { elevenVoiceId: "VR6AewLTigWG4xSOukaG", personality: "Strong, vigilant, no-nonsense" }, // Arnold
  },
  {
    id: "editor", name: "Editor Agent", codename: "NOVA",
    role: "Edits videos and pictures professionally.", status: "standby",
    tagline: "Ready to start editing.",
    voice: { elevenVoiceId: "AZnzlk1XvdvUeBnXmlld", personality: "Creative, energetic" }, // Domi
  },
  {
    id: "social", name: "Social Media Manager", codename: "MAYA",
    role: "Handles social accounts, SEO, scheduling and auto-posting.", status: "standby",
    tagline: "Taking over your social channels.",
    voice: { elevenVoiceId: "jBpfuIE2acCO8z3wKNLl", personality: "Upbeat, trendy" }, // Gigi
  },
  {
    id: "world", name: "World Reports Agent", codename: "ATLAS",
    role: "Provides latest world trending news and reports.", status: "active",
    tagline: "Compiling the latest world reports.",
    voice: { elevenVoiceId: "onwK4e9ZLuTAKqWW03F9", personality: "News-anchor authority" }, // Daniel
  },
  {
    id: "pc", name: "PC Reporter Agent", codename: "VICTOR",
    role: "Monitors PC health (CPU, temp, RAM) and local system tasks.", status: "active",
    tagline: "Running system diagnostics.",
    voice: { elevenVoiceId: "N2lVS1w4EtoT3dr4eOWO", personality: "Technical, precise" }, // Callum
  },
  {
    id: "crm", name: "CRM Agent", codename: "CLAIRE",
    role: "Manages business CRM, leads, customers and sales pipeline.", status: "standby",
    tagline: "Opening the sales pipeline.",
    voice: { elevenVoiceId: "XB0fDUnXU5powFXDhCwa", personality: "Professional, warm" }, // Charlotte
  },
  {
    id: "email", name: "Email Agent", codename: "OSCAR",
    role: "Sends bulk emails (100+ at once) with one command.", status: "standby",
    tagline: "Preparing the mail systems.",
    voice: { elevenVoiceId: "IKne3meq5aSn9XLyUdCD", personality: "Crisp, efficient" }, // Charlie
  },
  {
    id: "whatsapp", name: "WhatsApp Manager", codename: "LEO",
    role: "Fully manages WhatsApp — messages, chats, automation.", status: "standby",
    tagline: "Connecting to WhatsApp.",
    voice: { elevenVoiceId: "TX3LPaxmHKxFdv7VOQHJ", personality: "Friendly, quick" }, // Liam
  },
  {
    id: "personal", name: "Personal Manager", codename: "GRACE",
    role: "Diet plans, physique, health issues and wellness tracking.", status: "standby",
    tagline: "Reviewing your wellness profile.",
    voice: { elevenVoiceId: "oWAxZDx7w5VEj9dCyTzz", personality: "Caring, calm" }, // Grace
  },
  {
    id: "planner", name: "Planner Agent", codename: "ETHAN",
    role: "Creates and organizes daily, weekly and monthly plans.", status: "active",
    tagline: "Organizing your schedule.",
    voice: { elevenVoiceId: "g5CIjZEefAph4nQFvHAz", personality: "Structured, optimistic" }, // Ethan
  },
  {
    id: "local", name: "Local Agent", codename: "MAX",
    role: "Handles all local PC operations and file management.", status: "standby",
    tagline: "Accessing local file systems.",
    voice: { elevenVoiceId: "ODq5zmih8GrVes37Dizd", personality: "Steady, reliable" }, // Patrick
  },
  {
    id: "finance", name: "Finance Agent", codename: "JHONNY",
    role: "Tracks finances, profit/loss, investments; gives advice.", status: "standby",
    tagline: "Crunching the numbers.",
    voice: { elevenVoiceId: "flq6f7yk4E4fJM5XTYuZ", personality: "Sharp, analytical" }, // Michael
  },
  {
    id: "research", name: "Research Agent", codename: "ALENA",
    role: "Daily scans for inventions, updates and research papers.", status: "active",
    tagline: "Gathering the latest intelligence.",
    voice: { elevenVoiceId: "XrExE9yKIg1WjnnlVkGX", personality: "Curious, articulate" }, // Matilda
  },
  {
    id: "closer", name: "Leads Closer Agent", codename: "BLAKE",
    role: "Writes & sends lead follow-ups and works to close deals.", status: "standby",
    tagline: "Lining up your leads.",
    voice: { elevenVoiceId: "bVMeCyTHy58xNoL34h3p", personality: "Persuasive, confident" }, // Jeremy
  },
  {
    id: "ytt", name: "YT & TikTok Manager", codename: "RYAN",
    role: "Manages YouTube/TikTok; builds content plans.", status: "standby",
    tagline: "Loading your content pipeline.",
    voice: { elevenVoiceId: "SOYHLrjzK2X1ezoPC6cr", personality: "Young, high-energy" }, // Harry
  },
];

/** Quick lookup by agent id (includes the CEO under id "ceo"). */
export function agentById(id: string): AgentDef | undefined {
  return AGENTS.find((a) => a.id === id);
}
