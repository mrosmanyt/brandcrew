/**
 * Creator OS — CapCut/Premiere scripts, hooks, thumbnails, upload checklist.
 * Uses the user's Gemini key via chatLLM.
 */
import { chatLLM } from "@/lib/llm";
import type { Settings } from "@/store/useSettingsStore";

export type CreatorOsTool =
  | "capcut_script"
  | "premiere_script"
  | "hook_writer"
  | "thumbnail_ideas"
  | "upload_checklist";

export const CREATOR_OS_TOOLS: { id: CreatorOsTool; label: string; hint: string }[] = [
  { id: "capcut_script", label: "CapCut script", hint: "Beat-by-beat mobile edit plan" },
  { id: "premiere_script", label: "Premiere script", hint: "Sequence + B-roll markers" },
  { id: "hook_writer", label: "Hook writer", hint: "First 3 seconds — scroll-stoppers" },
  { id: "thumbnail_ideas", label: "Thumbnail ideas", hint: "3 punchy overlay concepts" },
  { id: "upload_checklist", label: "Upload checklist", hint: "Title, tags, description, timing" },
];

export async function runCreatorOsTool(
  tool: CreatorOsTool,
  topic: string,
  settings: Settings,
): Promise<string> {
  const prompts: Record<CreatorOsTool, string> = {
    capcut_script: `Write a CapCut/mobile edit script for: "${topic}". Sections: HOOK (0-3s), BODY beats, CTA. Include on-screen text cues.`,
    premiere_script: `Write a Adobe Premiere Pro edit script for: "${topic}". Include sequence names, B-roll inserts, lower-thirds, export settings.`,
    hook_writer: `Write 5 scroll-stopping video hooks (under 12 words each) for: "${topic}". Number them.`,
    thumbnail_ideas: `Suggest 3 YouTube thumbnail concepts for: "${topic}". Each: background, face expression, overlay text (2-4 words), color palette.`,
    upload_checklist: `Upload checklist for a YouTube video about: "${topic}". Title (<70 chars), description, 10 tags, best publish time, end-screen CTA.`,
  };
  return (
    await chatLLM(prompts[tool], settings, {
      system: "You are a creator-ops assistant for YouTube and short-form video. Be concrete and actionable.",
      temperature: 0.7,
      maxTokens: 900,
    })
  ).trim();
}
