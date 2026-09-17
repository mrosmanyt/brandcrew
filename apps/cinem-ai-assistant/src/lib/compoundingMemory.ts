/**
 * Compounding memory categories — brand voice, past videos, audience notes.
 * Stored in longMemory with category prefixes for morning briefing injection.
 */
import { addMemory, searchMemory, type MemoryEntry } from "@/lib/longMemory";

export type MemoryCategory = "brand_voice" | "past_video" | "audience";

const PREFIX: Record<MemoryCategory, string> = {
  brand_voice: "[brand]",
  past_video: "[video]",
  audience: "[audience]",
};

export function categoryFromText(text: string): MemoryCategory | null {
  if (text.startsWith(PREFIX.brand_voice)) return "brand_voice";
  if (text.startsWith(PREFIX.past_video)) return "past_video";
  if (text.startsWith(PREFIX.audience)) return "audience";
  return null;
}

export async function addCategoryMemory(category: MemoryCategory, body: string) {
  const text = `${PREFIX[category]} ${body.trim()}`;
  return addMemory(text);
}

export async function memoriesForBriefing(limit = 6): Promise<MemoryEntry[]> {
  const all = await searchMemory("brand video audience creator style", limit * 3);
  return all.filter((m) => categoryFromText(m.text)).slice(0, limit);
}

export function formatBriefingMemories(entries: MemoryEntry[]): string {
  if (!entries.length) return "";
  return entries.map((e) => `- ${e.text.replace(/^\[[^\]]+\]\s*/, "")}`).join("\n");
}
