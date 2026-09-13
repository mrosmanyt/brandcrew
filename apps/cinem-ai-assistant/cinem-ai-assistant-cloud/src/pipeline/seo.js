import { generate, parseJson } from "../lib/llm.js";

/** Step 2 — SEO title/description/tags (strict JSON). */
export async function writeSeo(tier, topic, script) {
  const fallback = {
    title: topic.slice(0, 90),
    description: `${topic}\n\nCINEM-AI-ASSISTANT AI se banaya gaya.`,
    tags: topic.toLowerCase().split(/\s+/).slice(0, 8),
  };
  const system =
    "You write YouTube SEO metadata. Reply with ONLY a JSON object: " +
    '{"title": "≤90 chars, high-CTR, same language as topic", ' +
    '"description": "2-4 lines + 3 hashtags", "tags": ["10-15 short tags"]}';
  const text = await generate(tier, {
    system,
    prompt: `Topic: ${topic}\n\nScript:\n${script.slice(0, 2000)}`,
    maxTokens: 600,
  });
  const seo = parseJson(text, fallback);
  return {
    title: String(seo.title || fallback.title).slice(0, 100),
    description: String(seo.description || fallback.description).slice(0, 4500),
    tags: (Array.isArray(seo.tags) ? seo.tags : fallback.tags).map(String).slice(0, 15),
  };
}
