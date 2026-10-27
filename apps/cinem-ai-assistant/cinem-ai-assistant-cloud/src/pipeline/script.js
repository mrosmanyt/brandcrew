import { generate } from "../lib/llm.js";

/** Step 1 — script likhna (desktop wale Script Studio ki cloud shakal). */
export async function writeScript(tier, topic) {
  const system =
    "You are Cinem AI Assistant's script writer for faceless YouTube videos. " +
    "Write in the SAME language as the topic (Urdu/Hindi topics get Roman Urdu/Hindi scripts, English gets English). " +
    "Structure: HOOK (first 3 seconds), 3-5 short scenes with [SCENE n] markers and narration text, then CTA. " +
    "Spoken-word style, short punchy sentences, no camera directions, no hashtags.";
  const prompt = `Topic: ${topic}\n\nWrite the complete narration script (60-90 seconds of speech).`;
  return generate(tier, { system, prompt, maxTokens: 1500 });
}
