/**
 * Cinem AI Assistant LLM client — Gemini (primary) with automatic Ollama fallback.
 * Uses tauri-plugin-http inside the desktop app (no CORS); plain fetch in
 * browser dev.
 */
import type { Settings } from "@/store/useSettingsStore";
import { reportUsage } from "@/lib/usage";
import { resolveModel, realGeminiModel, type Provider } from "@/lib/models";

const IS_TAURI = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

async function getFetch(): Promise<typeof fetch> {
  if (IS_TAURI) return (await import("@tauri-apps/plugin-http")).fetch;
  return window.fetch.bind(window);
}

export interface HistoryTurn {
  role: "user" | "assistant";
  text: string;
}

export interface LlmOptions {
  /** Force the model to emit raw JSON (used by the router). */
  json?: boolean;
  /** System instruction / persona for this call. */
  system?: string;
  /** Prior conversation turns for context (memory). */
  history?: HistoryTurn[];
  /** Max output tokens (bigger = longer deliverables). Default 2048. */
  maxTokens?: number;
  /** Sampling temperature. Default 0.7. */
  temperature?: number;
}

/* ── Claude (Anthropic) ───────────────────────────────────────────── */
async function claude(prompt: string, s: Settings, opts?: LlmOptions): Promise<string> {
  // Premium display name is mapped to a cheap real model in models.ts.
  const { model } = resolveModel(s);
  const realModel = model || "claude-sonnet-4-5";
  const doFetch = await getFetch();

  // Anthropic requires the conversation to START with a user turn.
  const hist = [...(opts?.history ?? [])];
  while (hist.length && hist[0].role !== "user") hist.shift();
  const messages = [
    ...hist.map((h) => ({ role: h.role, content: h.text })),
    { role: "user" as const, content: prompt },
  ];

  // Anthropic has no JSON mode flag — nudge via the system instruction.
  const system =
    (opts?.system ?? "") + (opts?.json ? "\nRespond with ONLY valid JSON, no prose or code fences." : "");

  const res = await doFetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": s.anthropicKey,
      "anthropic-version": "2023-06-01",
      // allow direct calls from the webview in browser-dev too
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: realModel,
      max_tokens: opts?.maxTokens ?? 2048,
      temperature: opts?.temperature ?? 0.7,
      ...(system.trim() ? { system: system.trim() } : {}),
      messages,
    }),
  });
  if (!res.ok) throw new Error(`Claude ${res.status}: ${await res.text()}`);

  const data = await res.json();
  const text = data?.content?.[0]?.text;
  if (!text) throw new Error("Claude returned an empty response");
  // (Usage metering for Claude can be added once a "claude" UsageKind exists.)
  return text as string;
}

/* ── Gemini ───────────────────────────────────────────────────────── */
async function gemini(prompt: string, s: Settings, opts?: LlmOptions): Promise<string> {
  // Always the cost-optimized real Gemini model (Flash), even as a fallback.
  const model = realGeminiModel(s);
  const doFetch = await getFetch();

  // Multi-turn contents: prior history (user/model) then the current prompt.
  const contents = [
    ...(opts?.history ?? []).map((h) => ({
      role: h.role === "assistant" ? "model" : "user",
      parts: [{ text: h.text }],
    })),
    { role: "user", parts: [{ text: prompt }] },
  ];

  const res = await doFetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${s.geminiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents,
        ...(opts?.system ? { systemInstruction: { parts: [{ text: opts.system }] } } : {}),
        generationConfig: {
          temperature: opts?.temperature ?? 0.7,
          maxOutputTokens: opts?.maxTokens ?? 2048,
          ...(opts?.json ? { responseMimeType: "application/json" } : {}),
        },
      }),
    },
  );
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned an empty response");

  // Usage metering: Gemini reports exact token counts per call.
  const meta = data?.usageMetadata;
  if (meta?.promptTokenCount || meta?.candidatesTokenCount) {
    reportUsage("gemini", meta.promptTokenCount ?? 0, meta.candidatesTokenCount ?? 0);
  }
  return text as string;
}

/* ── Ollama ───────────────────────────────────────────────────────── */
async function ollama(prompt: string, s: Settings, opts?: LlmOptions): Promise<string> {
  const doFetch = await getFetch();

  // /api/generate has no role array — fold system + history into the prompt.
  let full = "";
  if (opts?.system) full += `${opts.system}\n\n`;
  for (const h of opts?.history ?? []) {
    full += `${h.role === "assistant" ? "Assistant" : "User"}: ${h.text}\n`;
  }
  full += opts?.history?.length ? `User: ${prompt}\nAssistant:` : prompt;

  const res = await doFetch(`${s.ollamaUrl.replace(/\/$/, "")}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: s.ollamaModel,
      prompt: full,
      stream: false,
      ...(opts?.json ? { format: "json" } : {}),
      options: {
        temperature: opts?.temperature ?? 0.7,
        num_predict: opts?.maxTokens ?? 2048,
      },
    }),
  });
  if (!res.ok) throw new Error(`Ollama ${res.status}: ${await res.text()}`);

  const data = await res.json();
  if (!data?.response) throw new Error("Ollama returned an empty response");
  return data.response as string;
}

/** True when a provider has the credentials needed to run. */
function providerReady(p: Provider, s: Settings): boolean {
  if (p === "claude") return !!s.anthropicKey;
  if (p === "gemini") return !!s.geminiKey;
  return true; // ollama (local)
}

function callProvider(p: Provider, prompt: string, s: Settings, opts?: LlmOptions): Promise<string> {
  if (p === "claude") return claude(prompt, s, opts);
  if (p === "gemini") return gemini(prompt, s, opts);
  return ollama(prompt, s, opts);
}

/**
 * Main entry — routes to the selected provider's REAL (cost-optimized) model,
 * with an automatic fallback chain. Selected → Gemini → Ollama, skipping any
 * provider that lacks credentials.
 */
export async function chatLLM(prompt: string, s: Settings, opts?: LlmOptions): Promise<string> {
  const { provider } = resolveModel(s);

  // Build the attempt order: chosen provider first, then sensible fallbacks.
  const order: Provider[] = [provider, "gemini", "ollama"].filter(
    (p, i, arr) => arr.indexOf(p) === i,
  ) as Provider[];
  const chain = order.filter((p) => providerReady(p, s));
  // Ollama is always available as the last resort.
  if (!chain.includes("ollama")) chain.push("ollama");

  let lastErr: unknown;
  for (const p of chain) {
    try {
      return await callProvider(p, prompt, s, opts);
    } catch (e) {
      lastErr = e;
      console.warn(`[Cinem AI Assistant] ${p} failed — trying next provider:`, e);
    }
  }
  throw new Error(
    `All models failed. Last error: ${lastErr instanceof Error ? lastErr.message : lastErr}. ` +
      `Add a Claude or Gemini API key in Settings → API, or start Ollama locally.`,
  );
}

/* ── Vision (multimodal) ──────────────────────────────────────────── */

/** Gemini multimodal — text prompt + a single JPEG image (base64, no prefix). */
async function geminiVision(prompt: string, imageB64: string, s: Settings): Promise<string> {
  const model = realGeminiModel(s); // cheap Flash, vision-capable
  const doFetch = await getFetch();
  const res = await doFetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${s.geminiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inlineData: { mimeType: "image/jpeg", data: imageB64 } },
          ],
        }],
        generationConfig: { temperature: 0.4 },
      }),
    },
  );
  if (!res.ok) throw new Error(`Gemini Vision ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini Vision returned an empty response");
  return text as string;
}

/** Ollama multimodal fallback (requires a vision model, e.g. `llava`). */
async function ollamaVision(prompt: string, imageB64: string, s: Settings): Promise<string> {
  const doFetch = await getFetch();
  const res = await doFetch(`${s.ollamaUrl.replace(/\/$/, "")}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "llava", prompt, images: [imageB64], stream: false }),
  });
  if (!res.ok) throw new Error(`Ollama Vision ${res.status}: ${await res.text()}`);
  const data = await res.json();
  if (!data?.response) throw new Error("Ollama Vision returned an empty response");
  return data.response as string;
}

/**
 * Analyzes an image with a vision model — Gemini primary, Ollama (llava)
 * fallback. `imageB64` is a base64 JPEG WITHOUT the data: prefix.
 */
export async function chatVision(prompt: string, imageB64: string, s: Settings): Promise<string> {
  const preferGemini = s.defaultModel !== "ollama" && !!s.geminiKey;
  if (preferGemini) {
    try {
      return await geminiVision(prompt, imageB64, s);
    } catch (e) {
      console.warn("[Cinem AI Assistant] Gemini Vision failed — trying Ollama llava:", e);
    }
  }
  try {
    return await ollamaVision(prompt, imageB64, s);
  } catch (e) {
    throw new Error(
      preferGemini
        ? `Vision failed on both Gemini and Ollama. ${e instanceof Error ? e.message : e}`
        : `Vision needs a model. Add a Gemini key in Settings, or run Ollama with a vision model (\`ollama pull llava\`). ${e instanceof Error ? e.message : e}`,
    );
  }
}
