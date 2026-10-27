/**
 * Script Studio (Phase 1 of the autonomous video factory).
 *
 * Topic → research → professional, scene-by-scene script. Each scene carries:
 *   - narration  (voiceover line)
 *   - visual     (AI video prompt — fed to Super Grok in Phase 2)
 *   - seconds    (clip length)
 * The scene `visual` prompts are the contract that Phase 2 (Grok automation)
 * will use to generate each clip.
 */
import { chatLLM } from "@/lib/llm";
import type { Settings } from "@/store/useSettingsStore";

export interface Scene {
  narration: string;
  visual: string;
  seconds: number;
}

export interface VideoScript {
  topic: string;
  title: string;
  hook: string;
  description: string;
  hashtags: string[];
  thumbnailIdea: string;
  scenes: Scene[];
}

const SCRIPT_SYS =
  "You are Cinem AI Assistant's Script Director — an elite faceless-YouTube scriptwriter who writes high-retention, viral short-form scripts. You output tight, punchy narration and vivid, specific AI-video prompts (camera, subject, lighting, motion, style) for each scene. No fluff.";

/** Suggests trending video topics for a niche (when the user has no topic). */
export async function suggestTrending(niche: string, s: Settings): Promise<string[]> {
  const raw = await chatLLM(
    `List 6 fresh, currently-trending faceless YouTube video ideas for the niche: "${niche || "general"}".
Each must be specific and click-worthy. Return ONLY a JSON array of 6 strings.`,
    s,
    { json: true, temperature: 0.8, maxTokens: 600 },
  );
  const m = raw.match(/\[[\s\S]*\]/);
  try { return m ? (JSON.parse(m[0]) as string[]).slice(0, 6) : []; } catch { return []; }
}

/** Generates a complete scene-by-scene script for a topic. */
export async function generateScript(
  topic: string, s: Settings, onStage?: (t: string) => void,
): Promise<VideoScript> {
  onStage?.("Researching the topic…");

  const prompt = `Write a complete faceless short-form video script (45-75 seconds, 7-10 scenes) on this topic:
"""${topic}"""

Each scene clip is ~6-8 seconds (AI video generators make short clips).

Return ONLY this JSON:
{
 "title": "<click-worthy YouTube title, <70 chars>",
 "hook": "<first 3-second hook line>",
 "description": "<2-3 line SEO description>",
 "hashtags": ["#tag", ...],
 "thumbnailIdea": "<one-line thumbnail concept>",
 "scenes": [
   {"narration": "<voiceover line>", "visual": "<detailed AI-video prompt: subject, action, camera, lighting, style>", "seconds": 7}
 ]
}

Make narration flow as ONE story across scenes. Make each visual prompt specific and cinematic so an AI video model produces great footage.`;

  onStage?.("Writing scene-by-scene script…");
  const raw = await chatLLM(prompt, s, { system: SCRIPT_SYS, json: true, temperature: 0.75, maxTokens: 3000 });

  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("Script model ne valid output nahi diya — dobara try karein.");
  const data = JSON.parse(m[0]);

  const scenes: Scene[] = Array.isArray(data.scenes)
    ? data.scenes.map((sc: Partial<Scene>) => ({
        narration: String(sc.narration ?? "").trim(),
        visual: String(sc.visual ?? "").trim(),
        seconds: Number(sc.seconds) || 7,
      })).filter((sc: Scene) => sc.visual)
    : [];
  if (!scenes.length) throw new Error("Script mein koi scene nahi bana.");

  return {
    topic,
    title: String(data.title ?? topic).slice(0, 100),
    hook: String(data.hook ?? ""),
    description: String(data.description ?? ""),
    hashtags: Array.isArray(data.hashtags) ? data.hashtags.map(String) : [],
    thumbnailIdea: String(data.thumbnailIdea ?? ""),
    scenes,
  };
}

/* ── Intent ────────────────────────────────────────────────────────── */
export interface ScriptIntent { topic: string }

export function matchScriptIntent(text: string): ScriptIntent | null {
  const t = text.toLowerCase();
  const isScript =
    /\bscript\b/.test(t) ||
    (/\bvideo\b/.test(t) && /\b(bana|banao|likho|write|create|idea)\b/.test(t) && !/\bedit|upload\b/.test(t));
  if (!isScript) return null;

  // Extract topic after common phrasings.
  let topic = text
    .replace(/.*\b(script|video)\b\s*(for|on|about|ke liye|pe|par|ki|banao|bana do|likho|write|create)?\s*/i, "")
    .replace(/\b(bana do|banao|likho|kar do)\b.*/i, "")
    .trim();
  if (topic.length < 3) topic = "";
  return { topic };
}
