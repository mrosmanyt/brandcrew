import { config } from "../config.js";

/**
 * LLM layer — model tier (fast/mid/best) → provider call.
 * fast = Gemini, mid/best = Claude (defaults .env me change ho sakte hain).
 * Mock mode ya key na hone par deterministic mock text (sirf mock mode me).
 */
export async function generate(tier, { system = "", prompt, maxTokens = 1200 }) {
  const model = config.models[tier] || config.models.fast;

  if (config.mock) return mockText(tier, prompt);

  const isGemini = model.startsWith("gemini");
  if (isGemini && config.geminiKey) return gemini(model, system, prompt, maxTokens);
  if (!isGemini && config.anthropicKey) return anthropic(model, system, prompt, maxTokens);

  // Ek hi key ho to usi se kaam chalao — fail hone se behtar.
  if (config.geminiKey) return gemini(config.models.fast, system, prompt, maxTokens);
  if (config.anthropicKey) return anthropic("claude-haiku-4-5", system, prompt, maxTokens);
  throw Object.assign(new Error("Koi LLM key set nahi (GEMINI_API_KEY ya ANTHROPIC_API_KEY)"), { status: 500 });
}

async function gemini(model, system, prompt, maxTokens) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.geminiKey}`;
  const body = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
    generationConfig: { maxOutputTokens: maxTokens, temperature: 0.8 },
  };
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "";
  if (!text) throw new Error("Gemini ne khali jawab diya");
  return text;
}

async function anthropic(model, system, prompt, maxTokens) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": config.anthropicKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({ model, max_tokens: maxTokens, ...(system ? { system } : {}), messages: [{ role: "user", content: prompt }] }),
  });
  if (!res.ok) throw new Error(`Claude ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const text = (data?.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
  if (!text) throw new Error("Claude ne khali jawab diya");
  return text;
}

function mockText(tier, prompt) {
  return [
    `[MOCK ${tier.toUpperCase()}] Ye demo output hai — real LLM key lagte hi asli script aayegi.`,
    `Topic: ${prompt.slice(0, 120)}`,
    "Scene 1: Hook — pehli 3 second me sawal.",
    "Scene 2: Problem — audience ka dard.",
    "Scene 3: Solution — 3 points.",
    "Scene 4: CTA — subscribe + comment.",
  ].join("\n");
}

/** LLM se strict JSON nikaalna (SEO step) — code fences saaf karke parse. */
export function parseJson(text, fallback) {
  try {
    const m = String(text).match(/\{[\s\S]*\}/);
    return m ? JSON.parse(m[0]) : fallback;
  } catch {
    return fallback;
  }
}
