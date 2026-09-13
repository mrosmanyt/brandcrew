/**
 * Quick actions — deterministic command handling that needs NO LLM.
 * Opens websites / apps and runs web searches directly via the system shell,
 * so commands like "open google" or "search latest news" always work even
 * with no Gemini key and no Ollama running.
 */
const IS_TAURI = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/** Opens a URL in the user's default browser (or new tab in plain-web dev). */
export async function openExternal(url: string): Promise<void> {
  if (IS_TAURI) {
    const { open } = await import("@tauri-apps/plugin-shell");
    await open(url);
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

/** Known sites/apps → URL. Keys are matched as words inside the command. */
const SITES: { keys: string[]; url: string; label: string }[] = [
  { keys: ["google maps", "maps"], url: "https://maps.google.com", label: "Google Maps" },
  { keys: ["google drive", "drive"], url: "https://drive.google.com", label: "Google Drive" },
  { keys: ["gmail", "google mail", "email", "mail"], url: "https://mail.google.com", label: "Gmail" },
  { keys: ["youtube", "yt"], url: "https://www.youtube.com", label: "YouTube" },
  { keys: ["whatsapp", "whats app"], url: "https://web.whatsapp.com", label: "WhatsApp Web" },
  { keys: ["chatgpt", "chat gpt", "openai"], url: "https://chat.openai.com", label: "ChatGPT" },
  { keys: ["facebook", "fb"], url: "https://www.facebook.com", label: "Facebook" },
  { keys: ["instagram", "insta", "ig"], url: "https://www.instagram.com", label: "Instagram" },
  { keys: ["twitter", "x.com"], url: "https://x.com", label: "X / Twitter" },
  { keys: ["linkedin"], url: "https://www.linkedin.com", label: "LinkedIn" },
  { keys: ["github"], url: "https://github.com", label: "GitHub" },
  { keys: ["reddit"], url: "https://www.reddit.com", label: "Reddit" },
  { keys: ["amazon"], url: "https://www.amazon.com", label: "Amazon" },
  { keys: ["netflix"], url: "https://www.netflix.com", label: "Netflix" },
  { keys: ["spotify"], url: "https://open.spotify.com", label: "Spotify" },
  { keys: ["tiktok"], url: "https://www.tiktok.com", label: "TikTok" },
  { keys: ["google"], url: "https://www.google.com", label: "Google" },
];

const googleSearch = (q: string) => `https://www.google.com/search?q=${encodeURIComponent(q)}`;

export interface QuickAction {
  label: string;      // short description for the thought log
  reply: string;      // what Cinem AI Assistant says
  run: () => Promise<void>;
}

export interface BrowserTarget {
  url: string;
  label: string;
  reply: string;
}

function resolveSite(target: string): { url: string; label: string } | null {
  const t = target.toLowerCase();
  // longest keys first so "google maps" wins over "google"
  const all = SITES.flatMap((s) => s.keys.map((k) => ({ k, url: s.url, label: s.label })));
  all.sort((a, b) => b.k.length - a.k.length);
  for (const { k, url, label } of all) {
    if (new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(t)) {
      return { url, label };
    }
  }
  return null;
}

/**
 * Resolves a command to a target URL (open a site, a bare domain, or a web
 * search), or null if it isn't a browser command. Shared by the shell-open
 * quick actions and the Playwright automation path.
 */
export function resolveBrowserTarget(text: string): BrowserTarget | null {
  const t = text.toLowerCase().trim();

  // ── open / launch / visit <site | url> ──
  const open = t.match(/^(?:open|launch|go to|goto|visit|start|show me)\s+(.+)$/);
  if (open) {
    const target = open[1].replace(/\b(website|site|app|page|the|for me|please)\b/g, "").trim();

    const site = resolveSite(target);
    if (site) return { url: site.url, label: `Open ${site.label}`, reply: `Opening ${site.label}.` };

    // bare domain like "open notion.so"
    const domain = target.match(/([a-z0-9-]+\.[a-z]{2,}(?:\.[a-z]{2,})?)/i);
    if (domain) {
      return { url: `https://${domain[1]}`, label: `Open ${domain[1]}`, reply: `Opening ${domain[1]}.` };
    }
    // otherwise treat it as a web search
    return {
      url: googleSearch(target),
      label: `Search "${target}"`,
      reply: `Opening a Google search for "${target}".`,
    };
  }

  // ── search / google <query>  (YouTube searches are handled by the media path) ──
  const search = t.match(/^(?:search|google|look up|lookup|find)\s+(?:for\s+)?(.+)$/);
  if (search && !/\byoutube\b|\byt\b/.test(t)) {
    const q = search[1].replace(/\bon (?:the )?(?:web|google|internet)\b/g, "").trim();
    return { url: googleSearch(q), label: `Search "${q}"`, reply: `Searching Google for "${q}".` };
  }

  return null;
}

/**
 * Returns a runnable action for direct commands (shell-open), or null if the
 * request should go to the LLM / agents instead.
 */
export function matchQuickAction(text: string): QuickAction | null {
  const target = resolveBrowserTarget(text);
  if (!target) return null;
  return { label: target.label, reply: target.reply, run: () => openExternal(target.url) };
}
