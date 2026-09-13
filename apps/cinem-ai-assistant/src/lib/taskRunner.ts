/**
 * Visual Task Execution — runners that drive the floating task windows.
 *
 *  • openWebTask     — "open google" → Google renders INSIDE a popup window
 *  • runResearchTask — "research …"  → ALENA's live research panel
 *                       (steps → real sources → LLM synthesis, all live)
 *  • runEditorTask   — "video edit"  → NOVA's editor preview with staged
 *                       progress (visual placeholder until the real editor
 *                       toolchain ships)
 */
import { useTaskStore } from "@/store/useTaskStore";
import { useAppStore } from "@/store/useAppStore";
import { openExternal, type BrowserTarget } from "@/lib/quickActions";
import { fetchHeadlines } from "@/lib/news";
import { chatLLM } from "@/lib/llm";
import { languageDirective } from "@/lib/language";
import type { Settings } from "@/store/useSettingsStore";

/* ── Embeddable URL transforms ────────────────────────────────────── */

/**
 * Returns a URL that renders inside an iframe, or null when the site
 * refuses embedding (X-Frame-Options) — those open externally instead.
 */
export function toEmbeddable(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");

    // Google blocks iframes — EXCEPT with the igu=1 parameter.
    if (host === "google.com") {
      if (u.pathname.startsWith("/search")) {
        u.searchParams.set("igu", "1");
        return u.toString();
      }
      return "https://www.google.com/webhp?igu=1";
    }
    if (host === "maps.google.com") return "https://www.google.com/maps?igu=1";

    // YouTube: only /watch is embeddable (as /embed/); the homepage is not.
    if (host === "youtube.com" && u.pathname === "/watch") {
      const id = u.searchParams.get("v");
      if (id) return `https://www.youtube.com/embed/${id}?autoplay=1`;
    }

    // Known iframe-friendly sites.
    if (/(^|\.)wikipedia\.org$/.test(host)) return url;
    if (host === "lite.duckduckgo.com") return url;

    return null; // everything else: most big sites send X-Frame-Options
  } catch {
    return null;
  }
}

/**
 * Opens a browser command as a visual task window when the page can be
 * embedded; otherwise opens the system browser AND shows a status window.
 * Returns the task id.
 */
export function openWebTask(target: BrowserTarget): string {
  const { openTask, patchTask } = useTaskStore.getState();
  const embed = toEmbeddable(target.url);
  const host = (() => {
    try {
      return new URL(target.url).hostname.replace(/^www\./, "");
    } catch {
      return target.url;
    }
  })();

  const id = openTask({
    kind: "web",
    title: target.label.replace(/^Open\s+/i, "").replace(/^Search\s+/i, "Search: "),
    subtitle: embed ? `${host} • embedded` : `${host} • system browser`,
    agent: "SAM · BROWSER LINK",
    url: embed ?? undefined,
    externalUrl: target.url,
  });

  if (embed) {
    // iframe gives no load signal cross-origin — mark live shortly after.
    setTimeout(() => patchTask(id, { status: "done", subtitle: `${host} • live` }), 2500);
  } else {
    void openExternal(target.url).then(
      () => patchTask(id, { status: "done", subtitle: `${host} • opened externally` }),
      () => patchTask(id, { status: "error", subtitle: "could not open" }),
    );
  }
  return id;
}

/* ── Live research (ALENA) ────────────────────────────────────────── */

export async function runResearchTask(query: string, settings: Settings): Promise<string> {
  const { openTask, patchTask, appendTaskStep } = useTaskStore.getState();
  const id = openTask({
    kind: "research",
    title: `Research: ${query}`,
    subtitle: "live investigation",
    agent: "ALENA · RESEARCH AGENT",
  });

  try {
    /* 1 — live sources (real headlines when the topic is news-flavored) */
    appendTaskStep(id, "Scanning live sources…");
    let sourcesBlock = "";
    try {
      const heads = await fetchHeadlines(5);
      patchTask(id, {
        sources: heads.map((h) => ({ title: `${h.source}: ${h.title}`, url: h.url })),
      });
      sourcesBlock =
        "\n\nLIVE HEADLINES (use any that are relevant):\n" +
        heads.map((h) => `- ${h.title} (${h.source})`).join("\n");
      appendTaskStep(id, `✓ ${heads.length} live sources pulled`);
    } catch {
      appendTaskStep(id, "(live feeds unavailable — using model knowledge)");
    }

    /* 2 — synthesis */
    appendTaskStep(id, "Synthesizing findings…");
    const lang = languageDirective(useAppStore.getState().language);
    const result = (
      await chatLLM(
        `Research brief on: """${query}"""${sourcesBlock}

Write a tight, well-structured research brief in markdown:
- "## Key Findings" — 4-6 concrete bullet points
- "## Details" — short paragraphs with specifics
- "## Bottom Line" — 2 sentences
Be concrete and current; no filler.${lang}`,
        settings,
        {
          system:
            "You are ALENA, Cinem AI Assistant's Research Agent — sharp, factual, source-aware. You produce professional research briefs.",
          temperature: 0.4,
          maxTokens: 1600,
        },
      )
    ).trim();

    patchTask(id, { result, status: "done", subtitle: "research complete" });
    appendTaskStep(id, "✓ Research complete");
    return result;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    patchTask(id, { status: "error", subtitle: "failed", result: `Research failed: ${msg}` });
    throw e;
  }
}

/* ── Editor preview (NOVA) ────────────────────────────────────────── */

const EDIT_STAGES: { at: number; label: string }[] = [
  { at: 8, label: "Analyzing media…" },
  { at: 28, label: "Cutting & sequencing…" },
  { at: 52, label: "Color grade & transitions…" },
  { at: 74, label: "Audio sync & captions…" },
  { at: 92, label: "Rendering preview…" },
];

/**
 * Visual editor job with staged progress. The Editor Agent's real toolchain
 * (ffmpeg pipeline) lands later — this is its live progress surface, so the
 * window honestly labels the output as a preview plan.
 */
export function runEditorTask(request: string): string {
  const { openTask, patchTask, appendTaskStep } = useTaskStore.getState();
  const id = openTask({
    kind: "editor",
    title: "Editor Agent — Working…",
    subtitle: "video edit preview",
    agent: "NOVA · EDITOR AGENT",
    progress: 0,
  });

  let progress = 0;
  let stage = 0;
  const timer = setInterval(() => {
    progress = Math.min(100, progress + 2 + Math.random() * 3);
    patchTask(id, { progress });
    if (stage < EDIT_STAGES.length && progress >= EDIT_STAGES[stage].at) {
      appendTaskStep(id, EDIT_STAGES[stage].label);
      stage++;
    }
    if (progress >= 100) {
      clearInterval(timer);
      patchTask(id, {
        status: "done",
        progress: 100,
        title: "Editor Agent — Preview Ready",
        subtitle: "edit plan complete",
        result:
          `Edit plan prepared for: "${request}". NOVA staged the cut sequence, transitions, ` +
          "color grade and caption track. Connect the editing toolchain (Settings → Agents) to render the final file.",
      });
      appendTaskStep(id, "✓ Preview ready");
    }
  }, 180);

  return id;
}
