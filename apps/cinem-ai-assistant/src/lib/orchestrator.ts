/**
 * Cinem AI Assistant Orchestrator — the core intelligence (Phase 3).
 *
 * Pipeline for every user command (typed or spoken):
 *   1. ROUTE   — LLM picks which of the 15 sub-agents should handle it
 *   2. THINK   — each step is streamed into a visible "thought" chat block
 *   3. RESPOND — LLM answers as Cinem AI Assistant in the persona of the routed agents
 *
 * Gemini is primary; Ollama is the automatic local fallback (see llm.ts).
 */
import { chatLLM } from "@/lib/llm";
import { getAgentImpl } from "@/lib/agents";
import { searchYouTube } from "@/lib/youtube";
import { resolveBrowserTarget } from "@/lib/quickActions";
import { openWebTask, runResearchTask, runEditorTask } from "@/lib/taskRunner";
import { runMorningBriefing } from "@/lib/morningProtocol";
import { addMemory, allMemories, memoryContext } from "@/lib/longMemory";
import { createCustomAgent, deleteCustomAgent, findCustomAgent } from "@/lib/customAgents";
import {
  maxOrganizeDownloads, maxConfirm, maxCancel, maxUndo, maxFind, maxCleanTemp, maxHasPending,
} from "@/lib/agents/local";
import { matchVisionIntent } from "@/lib/vision";
import { matchEditIntent, STYLE_LABEL } from "@/lib/nova";
import { useNovaStore } from "@/store/useNovaStore";
import { matchUploadIntent } from "@/lib/uploader";
import { useUploadStore } from "@/store/useUploadStore";
import { matchThumbnailIntent } from "@/lib/thumbnails";
import { useThumbStore } from "@/store/useThumbStore";
import { matchScriptIntent } from "@/lib/scriptStudio";
import { useScriptStore } from "@/store/useScriptStore";
import { useGrokStore } from "@/store/useGrokStore";
import { useAutopilotStore } from "@/store/useAutopilotStore";
import { conversationHistory, type HistoryTurn } from "@/lib/memory";
import { announceAgent, announceCEO } from "@/lib/announcer";
import { agentById } from "@/data/agents";
import { detectLanguage, languageDirective } from "@/lib/language";
import { logActivity, getDeviceUser } from "@/lib/db";
import { reportUsage } from "@/lib/usage";
import { useCinemCloudStore } from "@/store/useCinemCloudStore";
import { useAppStore } from "@/store/useAppStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useVisionStore } from "@/store/useVisionStore";

interface Routing {
  agents: string[];
  plan: string;
}

/* ── Prompts ──────────────────────────────────────────────────────── */

function routingPrompt(request: string): string {
  const { agents } = useAppStore.getState();
  const roster = agents
    .map((a) => `- ${a.id}: ${a.name} — ${a.role} [${a.status.toUpperCase()}]`)
    .join("\n");

  return `You are the Orchestrator of Cinem AI Assistant, a personal AI assistant with 15 specialized sub-agents.

Available agents:
${roster}

Pick the 1-3 most relevant agents for the user request (prefer ACTIVE ones, but you may pick STANDBY agents when clearly needed) and write a one-sentence execution plan.

Respond with ONLY this JSON, nothing else:
{"agents": ["agent_id"], "plan": "one short sentence"}

User request: """${request}"""`;
}

/** Language directive for the user's CURRENT language (set per message). */
const langDir = (): string => languageDirective(useAppStore.getState().language);

/** Long-term memory block for the CURRENT request (set per message) —
 *  injected into every reply-generating prompt so Cinem AI Assistant uses what it
 *  knows about the user automatically. */
let memBlock = "";

function replyPrompt(request: string, routing: Routing): string {
  const { agents } = useAppStore.getState();
  const routed = agents.filter((a) => routing.agents.includes(a.id));
  const personas = routed.map((a) => `${a.name} (${a.role})`).join("; ") || "Cinem AI Assistant core";

  return `You are Cinem AI Assistant, a personal intelligent cyber assistant with a clean, confident, slightly futuristic tone.
This request was routed to: ${personas}.
Execution plan: ${routing.plan}

Rules:
- Answer the request as helpfully and concretely as you can right now.
- If the task needs real-world actions these agents can't perform yet (their tool integrations arrive in Phase 4), briefly say what the agent WILL do once enabled, then still give the best immediate answer/advice you can.
- Keep it concise (under 120 words). No markdown headers.${langDir()}${memBlock}

User request: """${request}"""`;
}

/* ── Helpers ──────────────────────────────────────────────────────── */

/** Tolerant JSON extraction — models sometimes wrap JSON in prose/fences. */
function parseRouting(raw: string): Routing {
  const match = raw.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      const obj = JSON.parse(match[0]);
      if (Array.isArray(obj.agents)) {
        return {
          agents: obj.agents.filter((a: unknown) => typeof a === "string"),
          plan: typeof obj.plan === "string" ? obj.plan : "Direct response.",
        };
      }
    } catch {
      /* fall through */
    }
  }
  return { agents: [], plan: "Direct response from Cinem AI Assistant core." };
}

const agentNames = (ids: string[]): string[] => {
  const { agents } = useAppStore.getState();
  return ids
    .map((id) => {
      const a = agents.find((x) => x.id === id);
      return a ? `${a.codename} · ${a.name}` : undefined;
    })
    .filter((n): n is string => !!n);
};

/* ── Media fast-path (Cinem AI Assistant Player / YouTube) ────────────────────── */

/**
 * Detects in-app media playback commands → Cinem AI Assistant Player.
 * NOTE: a bare "open youtube" is NOT media (that opens the website via a quick
 * action); only "play …", "… cinem-ai-assistant player", or a YouTube *search/watch*
 * counts as media.
 */
function isMediaCommand(text: string): boolean {
  const t = text.toLowerCase();
  if (/\bcinem-ai-assistant player\b/.test(t)) return true;
  if (/\bplay\b/.test(t)) return true;
  if (/\byoutube\b/.test(t) && /\b(search|watch|stream|find)\b/.test(t)) return true;
  return false;
}

/** Strips trigger phrasing to leave the bare search query. */
function extractMediaQuery(text: string): string {
  return text
    .replace(/\b(open|launch|start)\s+(youtube|cinem-ai-assistant player)\s*(and|then)?\s*/gi, "")
    .replace(/\b(on|in|from)\s+(youtube|the\s+)?(cinem-ai-assistant\s+)?player\b/gi, "")
    .replace(/\bon\s+youtube\b/gi, "")
    .replace(/\byoutube\b/gi, "")
    .replace(/\b(please|can you|could you|for me)\b/gi, "")
    .replace(/\b(play|watch|put on|stream)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Extracts the topic/niche from an Auto-Pilot command (Phase 4).
 *  Urdu word order puts the subject BEFORE "par/pe", English AFTER "about/on",
 *  so we just strip all command words + connectors and keep what remains. */
function extractFactorySubject(text: string): string {
  return text
    .replace(/\b(auto ?pilot|autopilot|campaign|video factory|factory)\b/gi, " ")
    .replace(/\b(30|thirty)\s*(din|days?|day)\b/gi, " ")
    .replace(/\b(daily|roz(ana)?|har ?din|everyday|every ?day|month|mahine?)\b/gi, " ")
    .replace(/\b(full ?auto|fully ?auto|start to finish|pura(?: process)?|complete)\b/gi, " ")
    .replace(/\b(banao|bana ?do|bana ?ke|bana ?kar|ready kar(?: ?do)?|kar ?do|generate|create|make|shuru|start)\b/gi, " ")
    .replace(/\b(video|videos|content|reel|reels|short|shorts)\b/gi, " ")
    .replace(/\b(upload|publish|youtube|research se|research)\b/gi, " ")
    .replace(/\b(about|on|regarding|niche|topic|ke ?baare ?me(?:in)?)\b/gi, " ")
    .replace(/\b(par|pe|ka|ke|ki|ko|liye|me|mein|ka ?ek|ek)\b/gi, " ")
    .replace(/\b(please|can you|could you|for me|cinem-ai-assistant)\b/gi, " ")
    .replace(/[",.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Searches YouTube and auto-plays the best match in the Cinem AI Assistant Player. */
async function handleMediaCommand(text: string, thoughtId: string): Promise<string> {
  const app = useAppStore.getState();
  const settings = useSettingsStore.getState();

  const query = extractMediaQuery(text) || text;
  app.patchMessage(thoughtId, { routedAgents: ["Cinem AI Assistant Player"] });
  app.appendStep(thoughtId, "Media command detected → Cinem AI Assistant Player");
  app.appendStep(thoughtId, `Searching YouTube: "${query}"`);

  const results = await searchYouTube(query, settings);
  const best = results[0];

  app.setPlayerResults(results);
  app.playVideo(best); // also switches the center tab to Cinem AI Assistant PLAYER
  app.appendStep(thoughtId, `▶ Streaming: ${best.title}`);
  app.patchMessage(thoughtId, { pending: false });

  const reply = `Now playing "${best.title}" by ${best.channel} in the Cinem AI Assistant Player.`;
  app.addMessage({ role: "assistant", text: reply });
  return reply;
}

/* ── Deep reasoning pipeline (plan → execute → reflect) ───────────── */

const PLANNER_SYS =
  "You are Cinem AI Assistant's planning module. You think step by step and break complex requests into a clear, actionable plan. You output ONLY the plan (numbered steps/sections), never the final deliverable.";

const EXECUTOR_SYS =
  "You are Cinem AI Assistant, an elite multi-domain expert consultant (business, finance, marketing, content, engineering, research, project management). You produce COMPLETE, professional, well-structured deliverables: clear section headings, concrete specifics, realistic numbers with the correct currency, tables or bullet lists where helpful, and genuinely actionable detail. You address EVERY explicit requirement in the request. You are never vague, generic, or filler.";

const CRITIC_SYS =
  "You are Cinem AI Assistant's reflection module — a meticulous senior reviewer. You strengthen a draft: fill any missing requested elements, correct unrealistic figures, tighten structure, and raise it to professional consulting quality. You output the IMPROVED FINAL deliverable only — not a critique.";

/** Heuristic: does this request warrant the full plan→execute→reflect path? */
function isComplexTask(text: string): boolean {
  const t = text.toLowerCase();
  const words = t.split(/\s+/).length;
  const longish = words >= 22 || text.length > 160;
  const multi = (t.match(/,|\band\b|\bthen\b|\bplus\b|\binclude\b|\bwith\b/g) ?? []).length >= 2;
  const heavy =
    /\b(business plan|marketing strateg|go.?to.?market|research report|project plan|content (?:plan|calendar|strategy)|step by step|detailed|comprehensive|complete|full plan|write (?:a|an|me)|create (?:a|an)|build (?:a|an|me)|develop|road ?map|proposal|analysis|strateg(?:y|ies)|curriculum|outline|budget|financial model|pitch deck)\b/.test(t);
  return (heavy && (longish || multi)) || (longish && multi);
}

interface PlanSection {
  title: string;
  agent: string; // collaborating expert (e.g. "Research Agent", "Finance Agent")
  focus: string;
}

/** Parses the planner's JSON; tolerant of fences/prose around it. */
function parsePlan(raw: string): { title: string; sections: PlanSection[] } | null {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const obj = JSON.parse(match[0]);
    if (!Array.isArray(obj.sections)) return null;
    const sections: PlanSection[] = obj.sections
      .filter((s: unknown) => s && typeof (s as PlanSection).title === "string")
      .slice(0, 6)
      .map((s: Partial<PlanSection>) => ({
        title: String(s.title),
        agent: typeof s.agent === "string" && s.agent ? s.agent : "Specialist",
        focus: typeof s.focus === "string" ? s.focus : "",
      }));
    return { title: typeof obj.title === "string" ? obj.title : "Deliverable", sections };
  } catch {
    return null;
  }
}

/**
 * Deep reasoning pipeline (plan → multi-agent section execution → reflect).
 * Each section is written by a relevant "expert agent" with full context of
 * what's already been produced, then a reflection pass polishes the whole doc.
 */
async function handleComplexTask(
  text: string,
  thoughtId: string,
  history: HistoryTurn[],
): Promise<string> {
  const app = useAppStore.getState();
  const settings = useSettingsStore.getState();

  /* 0 — The CEO takes command of complex tasks (deep, confident voice). */
  announceCEO();
  app.flashAgent("ceo"); // CEO node glow burst in the SUB AGENTS panel
  app.appendStep(thoughtId, "👑 SAM (Main Orchestrator) has taken command");

  /* 1 — PLAN (structured, assigns a collaborating agent per section) */
  app.appendStep(thoughtId, "🧠 Planning & assigning expert agents…");
  const planRaw = await chatLLM(
    `Break this request into a structured plan. Choose the most relevant expert for each section (e.g. Research Agent, Finance Agent, Planner Agent, Social Media Manager, Editor Agent, Security Agent, or a fitting specialist).

Respond with ONLY this JSON:
{"title":"<deliverable title>","sections":[{"title":"<section>","agent":"<expert>","focus":"<what to cover>"}]}

Use 4-6 sections that together FULLY cover every explicit requirement.

Request: """${text}"""`,
    settings,
    { system: PLANNER_SYS, history, temperature: 0.4, maxTokens: 1200, json: true },
  );

  const plan = parsePlan(planRaw) ?? {
    title: "Deliverable",
    sections: [{ title: "Complete Response", agent: "Specialist", focus: text }],
  };

  // Show the plan + the collaborating agents.
  const collaborators = [...new Set(plan.sections.map((s) => s.agent))];
  app.patchMessage(thoughtId, { routedAgents: ["Deep Reasoning", ...collaborators] });
  plan.sections.forEach((s, i) => app.appendStep(thoughtId, `${i + 1}. ${s.title} — ${s.agent}`));

  /* 2 — EXECUTE each section with its expert agent, in context */
  const parts: string[] = [];
  for (let i = 0; i < plan.sections.length; i++) {
    const sec = plan.sections[i];
    app.appendStep(thoughtId, `✍️ ${sec.agent}: writing "${sec.title}"…`);

    // Condensed running context so sections stay coherent without repeating.
    const soFar = parts.join("\n\n");
    const context = soFar.length > 2600 ? `${soFar.slice(-2600)}…` : soFar;

    try {
      const section = (
        await chatLLM(
          `Write the "${sec.title}" section of: ${plan.title}.
Focus: ${sec.focus || sec.title}.

ORIGINAL REQUEST: """${text}"""
${context ? `\nALREADY WRITTEN (continue coherently, do NOT repeat):\n${context}` : ""}

Write ONLY this section in full professional detail. Use a markdown "## ${sec.title}" heading, bullet points, and tables where useful. Include realistic specifics and figures with the correct currency. Be concrete, not generic.`,
          settings,
          {
            system: `You are Cinem AI Assistant's ${sec.agent}, a top expert collaborating on a larger deliverable. ${EXECUTOR_SYS}${langDir()}${memBlock}`,
            history,
            temperature: 0.6,
            maxTokens: 2600,
          },
        )
      ).trim();
      parts.push(section);
      app.appendStep(thoughtId, `✓ ${sec.title}`);
    } catch (e) {
      app.appendStep(thoughtId, `✗ ${sec.title}: ${e instanceof Error ? e.message : e}`);
      parts.push(`## ${sec.title}\n\n_(This section could not be generated.)_`);
    }
  }

  const assembled = `# ${plan.title}\n\n${parts.join("\n\n")}`;

  /* 3 — REFLECT: polish the whole document (cohesion, gaps, formatting) */
  app.appendStep(thoughtId, "🔍 Reviewing, refining & formatting…");
  let final = assembled;
  try {
    final = (
      await chatLLM(
        `You are finalizing this multi-section deliverable. Improve cohesion, remove any repetition between sections, ensure EVERY requirement from the request is covered, verify figures are realistic, and keep clean markdown (headings, bullet points, tables). Output the polished FINAL document only.

REQUEST: """${text}"""

DRAFT:
${assembled}

Final polished document:`,
        settings,
        { system: `${CRITIC_SYS}${langDir()}`, temperature: 0.35, maxTokens: 8192 },
      )
    ).trim();
  } catch (e) {
    app.appendStep(thoughtId, `(reflection skipped: ${e instanceof Error ? e.message : e})`);
  }

  app.appendStep(thoughtId, "✓ Complete");
  app.patchMessage(thoughtId, { pending: false });
  app.addMessage({ role: "assistant", text: final });
  return final;
}

/* ── Main entry ───────────────────────────────────────────────────── */

/**
 * Processes a user command end-to-end and returns Cinem AI Assistant's reply text
 * (the voice bar speaks the returned string).
 */
export async function processCommand(text: string): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed) return "";

  const cloud = useCinemCloudStore.getState();
  try {
    const usage = await cloud.consumeTurn();
    if (!usage.allowed) {
      cloud.showUpgrade(usage);
      return "";
    }
  } catch (error) {
    cloud.showUpgrade(cloud.usage);
    useAppStore.getState().addMessage({
      role: "system",
      text:
        error instanceof Error
          ? error.message
          : "Could not reach CINEM Pro usage. Sign in again or upgrade.",
    });
    return "";
  }

  const app = useAppStore.getState();
  const settings = useSettingsStore.getState();

  // Capture conversation memory BEFORE adding the current message.
  // (History keeps each turn in its ORIGINAL language, so context follows
  // the user across language switches.)
  const history = conversationHistory();

  /* Multi-language: detect the dominant language of THIS message — Cinem AI Assistant
     always replies in the language the user just used. */
  const lang = detectLanguage(trimmed);
  if (lang.code !== app.language.code) app.setLanguage(lang);

  /* Long-term memory: fetch the most relevant remembered facts for this
     request (vector search via local Ollama; keyword fallback). Injected
     into every reply-generating prompt below. */
  memBlock = await memoryContext(trimmed).catch(() => "");

  app.addMessage({ role: "user", text: trimmed });

  // Activity log (admin panel: per-user command history + usage stats).
  void (async () => {
    const u = await getDeviceUser().catch(() => null);
    await logActivity("command", trimmed.slice(0, 140), u?.id ?? null, u?.name);
  })();
  reportUsage("command");

  // Visible "brain" block — updated live while the orchestrator works
  const thoughtId = app.addMessage({
    role: "system",
    kind: "thought",
    text: "Thought process",
    steps: [
      "Analyzing request…",
      ...(lang.code !== "en" ? [`🌐 Language detected: ${lang.name} — replying in ${lang.name}`] : []),
    ],
    pending: true,
  });

  try {
    /* 0a — Media fast-path: "play despacito on youtube" → Cinem AI Assistant Player.
       On failure (quota, no results…) we fall through to normal routing. */
    if (isMediaCommand(trimmed)) {
      try {
        return await handleMediaCommand(trimmed, thoughtId);
      } catch (e) {
        app.appendStep(
          thoughtId,
          `Cinem AI Assistant Player unavailable (${e instanceof Error ? e.message : e}) — rerouting…`,
        );
      }
    }

    /* 0a0 — Phase 4 Auto-Pilot: one-command full chain + 30-day campaign.
       Must run before the single-step (script/grok/assemble/edit) fast-paths. */
    {
      const t = trimmed.toLowerCase();
      const wantsCampaign =
        /\b(auto ?pilot|autopilot|campaign)\b/.test(t) ||
        ((/\b(30|thirty)\b/.test(t) && /\b(din|day|days)\b/.test(t)) ||
          /\b(daily|roz(ana)?|har ?din|everyday|every ?day)\b/.test(t)) &&
          /\b(video|content|upload)\b/.test(t);
      const wantsFullChain =
        /\b(full ?auto|fully ?auto|auto video|video factory|factory)\b/.test(t) ||
        (/\bvideo\b/.test(t) &&
          /\b(bana ?ke upload|bana ?kar upload|upload kar ?do|research se|start to finish|pura(?: process)?|complete (?:video|process))\b/.test(t));

      if (wantsCampaign || wantsFullChain) {
        app.patchMessage(thoughtId, { routedAgents: ["Auto-Pilot"] });
        if (!settings.clipsFolder) {
          app.patchMessage(thoughtId, { pending: false });
          const reply = "Pehle Settings → NOVA mein clips folder set karein (yahan scenes + final video save honge).";
          app.addMessage({ role: "assistant", text: reply });
          return reply;
        }
        const subject = extractFactorySubject(trimmed);
        if (!subject) {
          app.patchMessage(thoughtId, { pending: false });
          const reply = wantsCampaign
            ? "Kis niche pe 30-din campaign chahiye? (e.g. \"AI tools\", \"history facts\")"
            : "Kis topic pe video bana ke upload karoon? Topic batayein.";
          app.addMessage({ role: "assistant", text: reply });
          return reply;
        }
        if (wantsCampaign) {
          app.appendStep(thoughtId, `30-din Auto-Pilot plan kar raha hoon — niche: "${subject}"`);
          const reply = await useAutopilotStore.getState().startCampaign(subject);
          app.patchMessage(thoughtId, { pending: false });
          app.addMessage({ role: "assistant", text: reply });
          return reply;
        }
        app.appendStep(thoughtId, `Full chain shuru: script → scenes → stitch → thumbnail → upload`);
        app.appendStep(thoughtId, `Topic: "${subject}"`);
        const reply = await useAutopilotStore.getState().runOnce(subject);
        app.appendStep(thoughtId, "✓ Auto-Pilot finished");
        app.patchMessage(thoughtId, { pending: false });
        app.addMessage({ role: "assistant", text: reply });
        return reply;
      }
    }

    /* 0a2 — NOVA: video editing ("high end cinematic edit kar do"). */
    const edit = matchEditIntent(trimmed);
    if (edit) {
      app.patchMessage(thoughtId, { routedAgents: ["NOVA Editor"] });
      const folder = settings.clipsFolder;
      if (!folder) {
        app.appendStep(thoughtId, "No clips folder set");
        app.patchMessage(thoughtId, { pending: false });
        const reply =
          "Pehle Settings → API → NOVA mein apna videos folder set karein, phir editing command dein.";
        app.addMessage({ role: "assistant", text: reply });
        return reply;
      }
      app.appendStep(thoughtId, `Style: ${STYLE_LABEL[edit.style]} • ${edit.count} clip(s)`);
      app.appendStep(thoughtId, "Starting NOVA ffmpeg engine…");
      const reply = await useNovaStore
        .getState()
        .edit(folder, edit.style, edit.count, settings.capcutPath || undefined);
      app.appendStep(thoughtId, "✓ NOVA finished");
      app.patchMessage(thoughtId, { pending: false });
      app.addMessage({ role: "assistant", text: reply });
      return reply;
    }

    /* 0a1c — Phase 3 Assemble: "scenes jodo / stitch karo / final video banao". */
    if (/\b(stitch|assemble|jod|joro|jodo|combine|final video)\b/i.test(trimmed)
        || /\bscenes?\b.*\b(jod|joro|jodo|stitch|combine|merge)\b/i.test(trimmed)) {
      app.patchMessage(thoughtId, { routedAgents: ["Assembler"] });
      const script = useScriptStore.getState().script;
      if (!script || !settings.clipsFolder) {
        app.patchMessage(thoughtId, { pending: false });
        const reply = "Pehle script + scenes (Grok) banayein, aur clips folder set karein.";
        app.addMessage({ role: "assistant", text: reply });
        return reply;
      }
      const root = settings.clipsFolder.replace(/[\\/]+$/, "");
      const { safeFolderName } = await import("@/lib/grokGen");
      const scenesFolder = `${root}\\CINEM-AI-ASSISTANT_Scenes\\${safeFolderName(script.title)}`;
      const outDir = `${root}\\CINEM-AI-ASSISTANT_Edited`;
      app.appendStep(thoughtId, "Scenes ko order mein stitch kar raha hoon…");
      const reply = await useNovaStore.getState().assemble(scenesFolder, outDir, "high");
      app.appendStep(thoughtId, "✓ Final video ready");
      app.patchMessage(thoughtId, { pending: false });
      app.addMessage({ role: "assistant", text: reply });
      return reply;
    }

    /* 0a1b — Super Grok video generation: "scenes generate karo / grok se video banao". */
    if (/\b(grok)\b/i.test(trimmed) || /\bscenes?\b.*\b(generate|banao|bana do)\b/i.test(trimmed)
        || /\b(generate|banao)\b.*\b(clips|footage|scenes?)\b/i.test(trimmed)) {
      app.patchMessage(thoughtId, { routedAgents: ["Grok Video"] });
      if (!useScriptStore.getState().script) {
        app.patchMessage(thoughtId, { pending: false });
        const reply = "Pehle script banayein (\"X pe video script bana do\"), phir scenes generate karunga.";
        app.addMessage({ role: "assistant", text: reply });
        return reply;
      }
      app.appendStep(thoughtId, "Super Grok mein scenes generate ho rahe hain…");
      const reply = await useGrokStore.getState().run();
      app.appendStep(thoughtId, "✓ Scene generation finished");
      app.patchMessage(thoughtId, { pending: false });
      app.addMessage({ role: "assistant", text: reply });
      return reply;
    }

    /* 0a1 — Script Studio: "X pe video script bana do". */
    const scriptIntent = matchScriptIntent(trimmed);
    if (scriptIntent) {
      app.patchMessage(thoughtId, { routedAgents: ["Script Director"] });
      app.appendStep(thoughtId, "Researching + writing script…");
      const reply = await useScriptStore.getState().generate(scriptIntent.topic);
      app.appendStep(thoughtId, "✓ Script ready");
      app.patchMessage(thoughtId, { pending: false });
      app.addMessage({ role: "assistant", text: reply });
      return reply;
    }

    /* 0a2b — Thumbnails: "thumbnails generate kar do". */
    if (matchThumbnailIntent(trimmed)) {
      app.patchMessage(thoughtId, { routedAgents: ["Thumbnail Agent"] });
      if (!settings.clipsFolder) {
        app.patchMessage(thoughtId, { pending: false });
        const reply = "Pehle Settings → API → NOVA mein clips folder set karein.";
        app.addMessage({ role: "assistant", text: reply });
        return reply;
      }
      app.appendStep(thoughtId, "Latest edited video dhoond raha hoon…");
      const { latestEditedVideo } = await import("@/lib/nova");
      const video = useNovaStore.getState().output ||
        (await latestEditedVideo(settings.clipsFolder).catch(() => null));
      if (!video) {
        app.patchMessage(thoughtId, { pending: false });
        const reply = "Koi video nahi mili. Pehle NOVA se video edit karein.";
        app.addMessage({ role: "assistant", text: reply });
        return reply;
      }
      app.appendStep(thoughtId, "Generating thumbnails (Gemini Vision + ffmpeg)…");
      const reply = await useThumbStore.getState().generate(video);
      app.appendStep(thoughtId, "✓ Thumbnails ready");
      app.patchMessage(thoughtId, { pending: false });
      app.addMessage({ role: "assistant", text: reply });
      return reply;
    }

    /* 0a3a — Confirmation reply when an upload is pending confirmation. */
    if (
      useUploadStore.getState().pending &&
      useUploadStore.getState().mode === "confirm" &&
      /^(haan|han|yes|yep|ok|okay|confirm|kar ?do|theek|sahi|go|👍)\b/i.test(trimmed)
    ) {
      app.patchMessage(thoughtId, { routedAgents: ["Upload Agent"], pending: false });
      app.appendStep(thoughtId, "Confirmed → uploading…");
      const reply = await useUploadStore.getState().confirm();
      app.addMessage({ role: "assistant", text: reply });
      return reply;
    }

    /* 0a3 — Multi-platform upload: auto-pick LATEST edited video → confirm. */
    const up = matchUploadIntent(trimmed);
    if (up) {
      app.patchMessage(thoughtId, { routedAgents: ["Upload Agent"] });
      if (!settings.clipsFolder) {
        app.patchMessage(thoughtId, { pending: false });
        const reply = "Pehle Settings → API → NOVA mein clips folder set karein.";
        app.addMessage({ role: "assistant", text: reply });
        return reply;
      }
      // Resolve the video: a specific named file → else NOVA's last export →
      // else the newest file in CINEM-AI-ASSISTANT_Edited / clips folder.
      app.appendStep(thoughtId, "Latest edited video dhoond raha hoon…");
      const { latestEditedVideo, findVideoByName } = await import("@/lib/nova");
      const named = trimmed.match(/["']([^"']+\.(?:mp4|mov|mkv|webm|m4v))["']/i)?.[1]
        ?? trimmed.match(/\b([\w\- ]+\.(?:mp4|mov|mkv|webm|m4v))\b/i)?.[1];
      let file: string | null = null;
      if (named) file = await findVideoByName(settings.clipsFolder, named).catch(() => null);
      if (!file) file = useNovaStore.getState().output || null;
      if (!file) file = await latestEditedVideo(settings.clipsFolder).catch(() => null);

      if (!file) {
        app.patchMessage(thoughtId, { pending: false });
        const reply =
          "Koi edited video nahi mili. Pehle NOVA se video edit karein ya clips folder check karein.";
        app.addMessage({ role: "assistant", text: reply });
        return reply;
      }

      const name = file.split(/[\\/]/).pop();
      app.appendStep(thoughtId, `Selected: ${name} → ${up.platforms.join(", ")}`);
      // Show confirmation panel (no upload yet) — user confirms via panel or "haan".
      useUploadStore.getState().prepare(file, up.platforms, trimmed);
      app.patchMessage(thoughtId, { pending: false });
      const reply =
        `Latest edited video "${name}" ko ${up.platforms.join(", ")} pe upload karne ke liye ready hoon. ` +
        `Panel mein "Confirm Upload" dabayein ya "haan" bolein.`;
      app.addMessage({ role: "assistant", text: reply });
      return reply;
    }

    /* 0b — Vision: camera / screen-share control + "what is this?" analysis. */
    const vision = matchVisionIntent(trimmed);
    if (vision) {
      const vs = useVisionStore.getState();
      app.patchMessage(thoughtId, { routedAgents: ["Vision Agent"] });

      if (vision.kind === "disable") {
        vs.disable();
        app.appendStep(thoughtId, "Vision disabled");
        app.patchMessage(thoughtId, { pending: false });
        const reply = "Camera and screen vision turned off.";
        app.addMessage({ role: "assistant", text: reply });
        return reply;
      }

      if (vision.kind === "enable-camera" || vision.kind === "enable-screen") {
        const isCam = vision.kind === "enable-camera";
        app.appendStep(thoughtId, isCam ? "Enabling camera…" : "Requesting screen share…");
        try {
          if (isCam) await vs.enableCamera();
          else await vs.enableScreen();
          app.appendStep(thoughtId, "✓ Live feed active");
          app.patchMessage(thoughtId, { pending: false });
          const reply = isCam
            ? "Camera is on. Point it at something and ask \"what is this?\""
            : "Screen sharing started. Ask me \"what's on my screen?\"";
          app.addMessage({ role: "assistant", text: reply });
          return reply;
        } catch (e) {
          app.appendStep(thoughtId, `✗ ${e instanceof Error ? e.message : e}`);
          app.patchMessage(thoughtId, { pending: false });
          const reply = useVisionStore.getState().error || "Couldn't start the camera/screen.";
          app.addMessage({ role: "assistant", text: reply });
          return reply;
        }
      }

      // analyze
      reportUsage("vision");
      app.appendStep(thoughtId, "Capturing frame…");
      try {
        if (vision.source === "screen" && vs.mode !== "screen") await vs.enableScreen();
        app.appendStep(thoughtId, "Analyzing with vision model…");
        const answer = await vs.analyze(vision.prompt);
        app.appendStep(thoughtId, "✓ Vision analysis complete");
        app.patchMessage(thoughtId, { pending: false });
        app.addMessage({ role: "assistant", text: answer });
        return answer;
      } catch (e) {
        app.appendStep(thoughtId, `✗ ${e instanceof Error ? e.message : e}`);
        app.patchMessage(thoughtId, { pending: false });
        const reply = `Vision error: ${e instanceof Error ? e.message : e}`;
        app.addMessage({ role: "assistant", text: reply });
        return reply;
      }
    }

    /* 0b2 — Morning Protocol on demand: "morning briefing", "daily report",
       "subah ka briefing"… → composed + spoken proactive briefing. */
    if (/\b(morning|daily|subah)\b[\s\S]*\b(briefing|protocol|report|update)\b|^briefing\b/i.test(trimmed)) {
      app.patchMessage(thoughtId, { routedAgents: ["SAM · Morning Protocol"] });
      app.appendStep(thoughtId, "🌅 Composing your briefing…");
      await runMorningBriefing(); // adds the chat message + speaks it itself
      app.appendStep(thoughtId, "✓ Briefing delivered");
      app.patchMessage(thoughtId, { pending: false });
      return ""; // empty → the voice bar won't speak it a second time
    }

    /* 0b2b — MAX · Local Agent: file operations (preview-first, undoable). */
    const maxReply = await (async (): Promise<string | null> => {
      const t = trimmed.toLowerCase();

      // pending confirmation: "yes" / "haan" / "confirm" / "cancel" / "no"
      if (maxHasPending()) {
        if (/^(yes|yep|haan|han|confirm|do it|execute|go ahead|kar do)\b/i.test(t)) {
          app.appendStep(thoughtId, "⚙ MAX executing confirmed plan…");
          return await maxConfirm();
        }
        if (/^(no|nahi|cancel|stop|rehne do)\b/i.test(t)) return maxCancel();
      }

      if (/\borgani[sz]e\b[\s\S]*\bdownloads?\b|\bdownloads?\b[\s\S]*\borgani[sz]e\b/i.test(t)) {
        announceAgent("local");
        app.flashAgent("local");
        reportUsage("agent");
        app.patchMessage(thoughtId, { routedAgents: ["MAX · Local Agent"] });
        app.appendStep(thoughtId, "📁 Scanning Downloads — preview window opening…");
        return await maxOrganizeDownloads();
      }

      if (/\bclean(?:\s*up)?\b[\s\S]*\b(temp|junk|cache)\b|\b(temp|junk)\b[\s\S]*\b(clean|saaf)\b/i.test(t)) {
        announceAgent("local");
        app.flashAgent("local");
        reportUsage("agent");
        app.patchMessage(thoughtId, { routedAgents: ["MAX · Local Agent"] });
        app.appendStep(thoughtId, "🧹 Calculating temp size — preview first…");
        return await maxCleanTemp();
      }

      if (
        /\b(find|search|locate|dhoondo)\b[\s\S]*\b(files?|file)\b/i.test(t) ||
        /\bfiles?\b[\s\S]*\b(over|above|larger than|bigger than)\s*\d+\s*(mb|gb)\b/i.test(t)
      ) {
        announceAgent("local");
        app.flashAgent("local");
        reportUsage("agent");
        app.patchMessage(thoughtId, { routedAgents: ["MAX · Local Agent"] });
        app.appendStep(thoughtId, "🔎 Searching the file system…");
        return await maxFind(trimmed);
      }

      if (/^undo(\s+(that|last|it))?\s*$/i.test(t) || /\bundo\b[\s\S]*\b(organi[sz]e|files|move)\b/i.test(t)) {
        announceAgent("local");
        app.flashAgent("local");
        app.patchMessage(thoughtId, { routedAgents: ["MAX · Local Agent"] });
        app.appendStep(thoughtId, "↩ Restoring files…");
        return await maxUndo();
      }

      return null;
    })().catch((e) => `MAX hit a snag, Sir: ${e instanceof Error ? e.message : e}`);

    if (maxReply) {
      app.appendStep(thoughtId, "✓ MAX done");
      app.patchMessage(thoughtId, { pending: false });
      app.addMessage({ role: "assistant", text: maxReply });
      return maxReply;
    }

    /* 0b3 — LONG-TERM MEMORY commands. */
    const remember =
      trimmed.match(/^remember\s+(?:that\s+)?(.+)$/i) ??
      trimmed.match(/^(.+?)\s+yaad\s+rakh(?:na|o|en)?\s*$/i);
    if (remember) {
      const fact = remember[1].trim();
      app.patchMessage(thoughtId, { routedAgents: ["Long-Term Memory"] });
      app.appendStep(thoughtId, "🧠 Committing to long-term memory…");
      const entry = await addMemory(fact);
      app.appendStep(thoughtId, `✓ Saved (${entry.embedding ? "vector-indexed" : "keyword-indexed"})`);
      app.patchMessage(thoughtId, { pending: false });
      const reply = `Noted, Sir — I'll remember that: "${fact}".`;
      app.addMessage({ role: "assistant", text: reply });
      return reply;
    }

    if (/\b(everything|all)\b[\s\S]*\bknow about me\b|what do you know about me|tell me what you remember/i.test(trimmed)) {
      app.patchMessage(thoughtId, { routedAgents: ["Long-Term Memory"] });
      app.appendStep(thoughtId, "🧠 Reading long-term memory…");
      const mems = await allMemories();
      let reply: string;
      if (!mems.length) {
        reply = "My memory banks are empty so far, Sir. Tell me \"remember that …\" and I'll never forget it.";
      } else {
        const list = mems.map((m) => `- ${m.text} (${m.createdAt.slice(0, 10)})`).join("\n");
        try {
          reply = (
            await chatLLM(
              `Summarize everything known about the user as a warm, organized profile (group related facts; under 160 words).${langDir()}\n\nMEMORIES:\n${list}`,
              settings,
              { system: "You are Cinem AI Assistant summarizing your own long-term memory of the user.", temperature: 0.4, maxTokens: 600 },
            )
          ).trim();
        } catch {
          reply = `Here's what I remember, Sir:\n${list}`;
        }
      }
      app.appendStep(thoughtId, `✓ ${mems.length} memories`);
      app.patchMessage(thoughtId, { pending: false });
      app.addMessage({ role: "assistant", text: reply });
      return reply;
    }

    /* 0b4 — CUSTOM AGENT builder: "create a new agent named Zain for stock
       market analysis" / "delete agent Zain". */
    const createA = trimmed.match(
      /create\s+(?:a\s+|an\s+)?(?:new\s+)?agent\s+(?:named|called)\s+([\w .-]+?)\s+(?:for|to|that)\s+(.+)/i,
    );
    if (createA) {
      const [, name, purpose] = createA;
      app.patchMessage(thoughtId, { routedAgents: ["Agent Builder"] });
      app.appendStep(thoughtId, `🛠 Building agent "${name.trim().toUpperCase()}"…`);
      try {
        const def = await createCustomAgent(name, purpose, settings);
        app.appendStep(thoughtId, `✓ ${def.codename} registered — voice assigned, online in SUB AGENTS`);
        app.patchMessage(thoughtId, { pending: false });
        const reply = `${def.codename} is built and online, Sir — ${def.role} You'll find ${def.codename} in the SUB AGENTS panel; just mention the task and I'll route it there.`;
        app.addMessage({ role: "assistant", text: reply });
        return reply;
      } catch (e) {
        const reply = `Couldn't build that agent: ${e instanceof Error ? e.message : e}`;
        app.appendStep(thoughtId, `✗ ${reply}`);
        app.patchMessage(thoughtId, { pending: false });
        app.addMessage({ role: "assistant", text: reply });
        return reply;
      }
    }

    const deleteA = trimmed.match(/(?:delete|remove)\s+(?:the\s+)?agent\s+([\w .-]+)/i);
    if (deleteA) {
      const target = findCustomAgent(deleteA[1]);
      app.patchMessage(thoughtId, { routedAgents: ["Agent Builder"], pending: false });
      const reply = target && deleteCustomAgent(target.id)
        ? `${target.codename} has been decommissioned, Sir.`
        : `I couldn't find a custom agent named "${deleteA[1].trim()}" — note that the 15 core agents can't be deleted, only disabled.`;
      app.addMessage({ role: "assistant", text: reply });
      return reply;
    }

    /* 0c — VISUAL editor jobs: "video edit karo", "edit this clip"… →
       NOVA's live preview window with staged progress. */
    if (/\b(video|clip|reel|photo|picture)\b[\s\S]*\bedit\b|\bedit\b[\s\S]*\b(video|clip|reel|photo|picture)\b/i.test(trimmed)) {
      announceAgent("editor");
      app.flashAgent("editor");
      app.patchMessage(thoughtId, { routedAgents: ["NOVA · Editor Agent"] });
      app.appendStep(thoughtId, "🎬 Editor task window opened — live preview running");
      runEditorTask(trimmed);
      app.patchMessage(thoughtId, { pending: false });
      const reply = "NOVA is on it, Sir — watch the live edit preview in the task window.";
      app.addMessage({ role: "assistant", text: reply });
      return reply;
    }

    /* 0d — VISUAL research: "research latest AI news", "research karo …" →
       ALENA's live panel (sources stream in, then the synthesized brief). */
    const research = trimmed.match(/^research\s+(?:on\s+|about\s+)?(.+)$/i)
      ?? trimmed.match(/^(.+?)\s+(?:par|pe|ki|ka)?\s*research\s*(?:karo|karein|kar)\s*$/i);
    if (research) {
      const query = research[1].replace(/\b(please|for me|karo|kar)\b/gi, "").trim() || trimmed;
      announceAgent("research");
      app.flashAgent("research");
      app.patchMessage(thoughtId, { routedAgents: ["ALENA · Research Agent"] });
      app.appendStep(thoughtId, `🔬 Live research window opened: "${query}"`);
      try {
        await runResearchTask(query, settings);
        app.appendStep(thoughtId, "✓ Research complete");
        app.patchMessage(thoughtId, { pending: false });
        const reply = `Research on "${query}" is complete, Sir — the full brief is in the task window.`;
        app.addMessage({ role: "assistant", text: reply });
        return reply;
      } catch (e) {
        app.appendStep(thoughtId, `✗ Research failed: ${e instanceof Error ? e.message : e}`);
        app.patchMessage(thoughtId, { pending: false });
        const reply = "The research run hit an error — check the task window for details.";
        app.addMessage({ role: "assistant", text: reply });
        return reply;
      }
    }

    /* 0e — Browser commands ("open google", "search news", "open github"…)
       → VISUAL task window. Embeddable pages (Google, Wikipedia, YouTube
       videos…) render inside the popup; everything else opens in the system
       browser with a live status window. No LLM needed. */
    const target = resolveBrowserTarget(trimmed);
    if (target) {
      app.patchMessage(thoughtId, { routedAgents: ["Browser Link"] });
      app.appendStep(thoughtId, `Browser action: ${target.label}`);
      reportUsage("browser");
      openWebTask(target);
      app.appendStep(thoughtId, "✓ Task window opened");
      app.patchMessage(thoughtId, { pending: false });
      app.addMessage({ role: "assistant", text: target.reply });
      return target.reply;
    }

    /* 0d — Complex task → deep reasoning (plan → execute → reflect). */
    if (isComplexTask(trimmed)) {
      return await handleComplexTask(trimmed, thoughtId, history);
    }

    /* 1 — Route (LLM) */
    const rawRouting = await chatLLM(routingPrompt(trimmed), settings, { json: true });
    const routing = parseRouting(rawRouting);
    const names = agentNames(routing.agents);

    app.patchMessage(thoughtId, { routedAgents: names });
    app.appendStep(
      thoughtId,
      names.length ? `Routing → ${names.join(" + ")}` : "Routing → Cinem AI Assistant core (no sub-agent needed)",
    );
    app.appendStep(thoughtId, `Plan: ${routing.plan}`);

    /* 1b — Activation announcements: every routed agent speaks its name in
       its OWN voice ("ALENA — Research Agent is activated, Sir. …") before
       work begins. Fire-and-forget queue: audio plays while agents work. */
    for (const id of routing.agents) {
      const def = agentById(id);
      if (!def) continue;
      announceAgent(id);
      app.appendStep(thoughtId, `🔊 ${def.codename} — ${def.name} is activated, Sir.`);
      app.flashAgent(id);
      reportUsage("agent");
    }

    /* 2 — Execute implemented agents (Phase 4) */
    const findings: { name: string; text: string }[] = [];
    for (const id of routing.agents) {
      const impl = getAgentImpl(id);
      const agent = useAppStore.getState().agents.find((a) => a.id === id);

      /* Custom (user-built) agents execute with their own system prompt. */
      if (!impl && agent?.custom && agent.prompt) {
        app.setAgentStatus(id, "processing");
        announceAgent(id);
        app.flashAgent(id);
        app.appendStep(thoughtId, `⚡ ${agent.codename} (custom) engaged`);
        try {
          const text = (
            await chatLLM(`${trimmed}`, settings, {
              system: `${agent.prompt}${langDir()}${memBlock}`,
              history,
              temperature: 0.6,
              maxTokens: 1800,
            })
          ).trim();
          findings.push({ name: agent.name, text });
          app.appendStep(thoughtId, `✓ ${agent.codename} finished`);
        } catch (e) {
          app.appendStep(thoughtId, `✗ ${agent.codename} failed: ${e instanceof Error ? e.message : e}`);
        } finally {
          app.setAgentStatus(id, "active");
        }
        continue;
      }

      if (!impl) continue;
      const name = agent?.name ?? id;
      const prevStatus = agent?.status === "processing" ? "active" : (agent?.status ?? "active");

      app.setAgentStatus(id, "processing");
      announceAgent(id); // de-duped if already announced during routing
      app.flashAgent(id);
      app.appendStep(thoughtId, `⚡ ${name} engaged`);
      try {
        const result = await impl.run({
          request: trimmed,
          settings,
          step: (s) => app.appendStep(thoughtId, `   ${name}: ${s}`),
        });
        findings.push({ name, text: result.findings });
        app.appendStep(thoughtId, `✓ ${name} finished`);
      } catch (e) {
        app.appendStep(thoughtId, `✗ ${name} failed: ${e instanceof Error ? e.message : e}`);
      } finally {
        app.setAgentStatus(id, prevStatus);
      }
    }

    /* 3 — Respond */
    let reply: string;
    if (findings.length === 1) {
      // Single specialist — its report IS the answer (already in persona)
      reply = findings[0].text;
    } else if (findings.length > 1) {
      app.appendStep(thoughtId, "Merging agent reports…");
      reply = (
        await chatLLM(
          `You are Cinem AI Assistant. Merge these specialist agent reports into ONE coherent answer to the user (under 150 words, plain text):

${findings.map((f) => `--- ${f.name} ---\n${f.text}`).join("\n\n")}
${langDir()}
User request: """${trimmed}"""`,
          settings,
          { history },
        )
      ).trim();
    } else {
      app.appendStep(thoughtId, "Synthesizing response…");
      reply = (await chatLLM(replyPrompt(trimmed, routing), settings, { history })).trim();
    }

    app.patchMessage(thoughtId, { pending: false });
    app.addMessage({ role: "assistant", text: reply });
    return reply;
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    app.patchMessage(thoughtId, { pending: false });
    app.appendStep(thoughtId, `⚠ AI model unavailable: ${raw}`);

    // The deterministic commands above never reach here — so this is an
    // LLM/agent failure. Guide the user clearly instead of dumping the error.
    const reply =
      "I couldn't reach an AI model for that request. Open Settings (⚙) → API and " +
      "add a Gemini API key, or start Ollama locally. " +
      'Tip: direct commands like "open google", "play lofi on youtube", ' +
      'or "search latest news" work without a model.';
    app.addMessage({ role: "assistant", text: reply });
    return reply;
  }
}
