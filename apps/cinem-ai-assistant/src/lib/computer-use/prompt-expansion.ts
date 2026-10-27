/**
 * Prompt-expansion skill — turns a short creative ask into a richer prompt
 * suitable for ChatGPT / creative tools. Model-agnostic via chatLLM routing.
 */
import { chatLLM } from "@/lib/llm";
import type { Settings } from "@/store/useSettingsStore";

const SYSTEM = `You expand short creative requests into detailed, actionable prompts.
Output ONLY the expanded prompt text — no preamble, no markdown fences.
Keep under 200 words. Include tone, audience, format, and constraints when relevant.`;

/** Heuristic: user wants creative prompt help before typing into ChatGPT. */
export function isPromptExpansionRequest(text: string): boolean {
  const t = text.toLowerCase();
  return (
    /\b(expand|enrich|flesh out|make.*prompt|better prompt|prompt for)\b/.test(t) ||
    /\b(chatgpt|gpt)\b.*\b(prompt|ask|question)\b/.test(t) ||
    /\bwrite.*for chatgpt\b/.test(t)
  );
}

/** Extract the subject to expand from natural language. */
export function extractExpansionSubject(text: string): string {
  const m = text.match(/(?:expand|enrich|prompt for|make a prompt for|write.*for chatgpt)[:\s]+(.+)/i);
  if (m?.[1]) return m[1].trim();
  return text.replace(/\b(expand|enrich|prompt|chatgpt|gpt|please|can you)\b/gi, " ").replace(/\s+/g, " ").trim();
}

/** Call configured LLM (Gemini / Ollama / BYOK) to expand the prompt. */
export async function expandCreativePrompt(subject: string, settings: Settings): Promise<string> {
  const user = `Short creative ask:\n"""${subject}"""\n\nExpanded prompt:`;
  const raw = await chatLLM(user, settings, { system: SYSTEM, maxTokens: 512, temperature: 0.75 });
  return raw.trim();
}
