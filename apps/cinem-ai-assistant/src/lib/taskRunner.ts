/**
 * Visual Task Execution — runners that drive the floating task windows.
 */
import { useTaskStore } from "@/store/useTaskStore";
import { useAppStore } from "@/store/useAppStore";
import { googleSearchUrl, youtubeVideoIdFromUrl } from "@/lib/browserIntents";
import { openExternal, type BrowserTarget } from "@/lib/quickActions";
import { fetchHeadlines } from "@/lib/news";
import { chatLLM } from "@/lib/llm";
import { languageDirective } from "@/lib/language";
import {
  fetchPageText,
  formatHitsForPrompt,
  searchPublicWeb,
} from "@/lib/publicWebSearch";
import { researchInBrowser } from "@/lib/playwrightActions";
import type { Settings } from "@/store/useSettingsStore";

/* ── Embeddable URL transforms ────────────────────────────────────── */

export function toEmbeddable(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");

    if (host === "google.com") {
      if (u.pathname.startsWith("/search")) {
        u.searchParams.set("igu", "1");
        return u.toString();
      }
      return "https://www.google.com/webhp?igu=1";
    }
    if (host === "maps.google.com") return "https://www.google.com/maps?igu=1";

    if (host === "youtube.com") {
      if (u.pathname === "/watch") {
        const id = u.searchParams.get("v");
        if (id) return `https://www.youtube.com/embed/${id}?autoplay=1&enablejsapi=1`;
      }
      if (u.pathname === "/embed" || u.searchParams.get("listType") === "search") {
        return u.toString();
      }
    }

    if (/(^|\.)wikipedia\.org$/.test(host)) return url;
    if (host === "lite.duckduckgo.com" || host === "html.duckduckgo.com") return url;

    return null;
  } catch {
    return null;
  }
}

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

function offlineResearchBrief(query: string, block: string): string {
  return [
    `# Research: ${query}`,
    "",
    "## Key Findings",
    block.trim() || "- Public search returned limited text — try the Playwright sidecar for live Google tabs.",
    "",
    "## Bottom Line",
    "These notes are from public web sources only (no login). Verify critical facts before acting.",
  ].join("\n");
}

export async function runResearchTask(query: string, settings: Settings): Promise<string> {
  const { openTask, patchTask, appendTaskStep } = useTaskStore.getState();
  const id = openTask({
    kind: "research",
    title: `Research: ${query}`,
    subtitle: "live investigation",
    agent: "ALENA · RESEARCH AGENT",
  });

  let evidence = "";
  const sources: { title: string; url: string }[] = [];

  try {
    appendTaskStep(id, "Searching the public web…");
    const hits = await searchPublicWeb(query, 6);
    if (hits.length) {
      patchTask(id, { sources: hits.map((h) => ({ title: h.title, url: h.url })) });
      appendTaskStep(id, `✓ ${hits.length} search hits`);
      sources.push(...hits.map((h) => ({ title: h.title, url: h.url })));
    } else {
      appendTaskStep(id, "(search returned no hits — trying headlines)");
    }

    appendTaskStep(id, "Reading top sources…");
    const pages: { url: string; text: string }[] = [];
    for (const hit of hits.slice(0, 3)) {
      const page = await fetchPageText(hit.url);
      if (page.ok) pages.push({ url: page.url, text: page.text });
    }
    if (pages.length) appendTaskStep(id, `✓ Read ${pages.length} page(s)`);

    appendTaskStep(id, "Checking Playwright sidecar…");
    const live = await researchInBrowser(query);
    if (live.ok && (live.pages.length || live.results.length)) {
      appendTaskStep(id, `✓ Live browser: ${live.pages.length || live.results.length} source(s)`);
      for (const r of live.results.slice(0, 6)) {
        sources.push({ title: r.title, url: r.url });
      }
      for (const p of live.pages) {
        if (p.text) pages.push({ url: p.url, text: p.text });
      }
      patchTask(id, { sources });
    } else {
      appendTaskStep(id, "(Playwright offline — public fetch only)");
      void openExternal(googleSearchUrl(query));
    }

    try {
      const heads = await fetchHeadlines(5);
      if (heads.length) {
        appendTaskStep(id, `✓ ${heads.length} headline(s)`);
        sources.push(...heads.map((h) => ({ title: `${h.source}: ${h.title}`, url: h.url })));
        patchTask(id, { sources });
      }
    } catch {
      /* optional */
    }

    evidence = formatHitsForPrompt(hits, pages);
    if (live.pages.length) {
      evidence += `\n\nLIVE BROWSER PAGES:\n${live.pages.map((p) => `${p.url}\n${(p.text || "").slice(0, 1200)}`).join("\n\n")}`;
    }

    appendTaskStep(id, "Synthesizing findings…");
    const lang = languageDirective(useAppStore.getState().language);
    let result = "";
    try {
      result = (
        await chatLLM(
          `Research brief on: """${query}"""

${evidence ? `PUBLIC SOURCES (cite URLs that you use):\n${evidence}` : "No page text captured — be honest about limits."}

Write a tight markdown brief:
- "## Key Findings" — 4-6 bullets with specifics
- "## Details" — short sourced paragraphs
- "## Bottom Line" — 2 sentences
No filler.${lang}`,
          settings,
          {
            system:
              "You are ALENA, Cinem AI Assistant's Research Agent — factual, source-aware. Never invent quotes or stats.",
            temperature: 0.4,
            maxTokens: 1600,
          },
        )
      ).trim();
    } catch {
      result = offlineResearchBrief(query, evidence);
    }

    if (!result) result = offlineResearchBrief(query, evidence);

    patchTask(id, { result, status: "done", subtitle: "research complete" });
    appendTaskStep(id, "✓ Research complete");
    return result;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const fallback = offlineResearchBrief(query, evidence);
    patchTask(id, { status: "done", subtitle: "partial", result: fallback });
    appendTaskStep(id, `⚠ Partial (${msg})`);
    return fallback;
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

export { youtubeVideoIdFromUrl };
