import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";

export type TaskMode = "draft" | "final";

/** Job-family routing. General keeps the existing cheap-draft / strong-final policy. */
export type LlmJobKind = "website" | "coding" | "posts" | "apps" | "general";

export type LlmProviderName = "openai" | "anthropic" | "gemini" | "xai" | "demo";

export type LlmStatus = {
  openai: boolean;
  anthropic: boolean;
  gemini: boolean;
  xai: boolean;
  configured: boolean;
  mode: "live" | "demo";
};

export type LlmRoute = {
  provider: "openai" | "anthropic" | "gemini" | "xai";
  model: string;
  apiKey: string;
};

export type LlmCompleteResult = {
  text: string;
  tokens: number;
  model: string;
  provider: LlmProviderName;
  demo: boolean;
};

export function openaiKey() {
  return process.env.OPENAI_API_KEY?.trim() || "";
}

export function anthropicKey() {
  return process.env.ANTHROPIC_API_KEY?.trim() || "";
}

export function geminiKey() {
  return (
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() ||
    ""
  );
}

export function xaiKey() {
  return process.env.XAI_API_KEY?.trim() || process.env.GROK_API_KEY?.trim() || "";
}

export function hasOpenAI() {
  return Boolean(openaiKey());
}

export function hasAnthropic() {
  return Boolean(anthropicKey());
}

export function hasGemini() {
  return Boolean(geminiKey());
}

export function hasXai() {
  return Boolean(xaiKey());
}

export function getLlmStatus(): LlmStatus {
  const openai = hasOpenAI();
  const anthropic = hasAnthropic();
  const gemini = hasGemini();
  const xai = hasXai();
  const configured = openai || anthropic || gemini || xai;
  return {
    openai,
    anthropic,
    gemini,
    xai,
    configured,
    mode: configured ? "live" : "demo",
  };
}

export function openaiDraftModel() {
  return process.env.OPENAI_DRAFT_MODEL || "gpt-4o-mini";
}

export function openaiFinalModel() {
  return process.env.OPENAI_FINAL_MODEL || "gpt-4.1";
}

export function anthropicDraftModel() {
  return process.env.ANTHROPIC_DRAFT_MODEL || "claude-haiku-4-5";
}

export function anthropicFinalModel() {
  return process.env.ANTHROPIC_FINAL_MODEL || "claude-sonnet-5";
}

export function geminiDraftModel() {
  return process.env.GEMINI_DRAFT_MODEL || "gemini-2.5-flash";
}

export function geminiFinalModel() {
  return process.env.GEMINI_FINAL_MODEL || "gemini-2.5-pro";
}

export function xaiPostsModel() {
  return process.env.XAI_POSTS_MODEL || process.env.XAI_MODEL || "grok-3-mini";
}

export function xaiBaseUrl() {
  return process.env.XAI_BASE_URL?.trim() || "https://api.x.ai/v1";
}

/**
 * Google Antigravity Agent API is a follow-up — too heavy for this MVP.
 * Website jobs stay on Gemini (cheap) when GEMINI_API_KEY is set.
 * See README → Model routing.
 */
export function antigravityFollowUp(): {
  status: "follow_up";
  reason: string;
} {
  return {
    status: "follow_up",
    reason:
      "Google Antigravity agent sessions are out of scope for this MVP. Website jobs use Gemini when GEMINI_API_KEY is set.",
  };
}

function firstRoute(
  candidates: Array<LlmRoute | null>,
): LlmRoute | null {
  return candidates.find((row): row is LlmRoute => Boolean(row)) ?? null;
}

function geminiRoute(mode: TaskMode): LlmRoute | null {
  const key = geminiKey();
  if (!key) return null;
  return {
    provider: "gemini",
    model: mode === "final" ? geminiFinalModel() : geminiDraftModel(),
    apiKey: key,
  };
}

function openaiRoute(mode: TaskMode): LlmRoute | null {
  const key = openaiKey();
  if (!key) return null;
  return {
    provider: "openai",
    model: mode === "final" ? openaiFinalModel() : openaiDraftModel(),
    apiKey: key,
  };
}

function anthropicRoute(mode: TaskMode): LlmRoute | null {
  const key = anthropicKey();
  if (!key) return null;
  return {
    provider: "anthropic",
    model: mode === "final" ? anthropicFinalModel() : anthropicDraftModel(),
    apiKey: key,
  };
}

function xaiRoute(): LlmRoute | null {
  const key = xaiKey();
  if (!key) return null;
  return { provider: "xai", model: xaiPostsModel(), apiKey: key };
}

/**
 * Router policy:
 * - Website → Gemini (cheap) when present, else OpenAI / Anthropic / xAI.
 * - Coding / apps → Anthropic when present, else Gemini / OpenAI / xAI.
 * - Posts → xAI only if keyed, else Gemini / OpenAI / Anthropic.
 * - General drafts: Gemini Flash → OpenAI mini → Haiku → xAI.
 * - General finals: Claude Sonnet → GPT-4.1 → Gemini Pro → xAI.
 */
export function pickRoute(
  mode: TaskMode,
  kind: LlmJobKind = "general",
): LlmRoute | null {
  if (kind === "website") {
    return firstRoute([geminiRoute("draft"), openaiRoute("draft"), anthropicRoute("draft"), xaiRoute()]);
  }
  if (kind === "coding" || kind === "apps") {
    return firstRoute([
      anthropicRoute(mode === "final" ? "final" : "draft"),
      geminiRoute("draft"),
      openaiRoute("draft"),
      xaiRoute(),
    ]);
  }
  if (kind === "posts") {
    return firstRoute([xaiRoute(), geminiRoute("draft"), openaiRoute("draft"), anthropicRoute("draft")]);
  }

  if (mode === "draft") {
    return firstRoute([geminiRoute("draft"), openaiRoute("draft"), anthropicRoute("draft"), xaiRoute()]);
  }
  return firstRoute([anthropicRoute("final"), openaiRoute("final"), geminiRoute("final"), xaiRoute()]);
}

export function createAnthropicClient(apiKey: string) {
  return new Anthropic({ apiKey });
}

export function createOpenAIClient(apiKey: string) {
  return new OpenAI({ apiKey });
}

export function createGeminiClient(apiKey: string) {
  return new GoogleGenAI({ apiKey });
}

export function createXaiClient(apiKey: string) {
  return new OpenAI({ apiKey, baseURL: xaiBaseUrl() });
}

function textFromAnthropic(content: Anthropic.ContentBlock[]) {
  return content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();
}

export class LLMProvider {
  status() {
    return getLlmStatus();
  }

  pickModel(mode: TaskMode, kind: LlmJobKind = "general") {
    return pickRoute(mode, kind);
  }

  isLiveFor(kind: LlmJobKind = "general") {
    return pickRoute("draft", kind) !== null || pickRoute("final", kind) !== null;
  }

  async complete(input: {
    mode: TaskMode;
    kind?: LlmJobKind;
    messages: { role: "system" | "user" | "assistant"; content: string }[];
    json?: boolean;
  }): Promise<LlmCompleteResult> {
    const route = pickRoute(input.mode, input.kind ?? "general");
    if (!route) {
      throw new Error("NO_LLM_KEYS");
    }

    if (route.provider === "anthropic") {
      return this.completeAnthropic(route, input);
    }
    if (route.provider === "gemini") {
      return this.completeGemini(route, input);
    }
    if (route.provider === "xai") {
      return this.completeXai(route, input);
    }
    return this.completeOpenAI(route, input);
  }

  private async completeOpenAI(
    route: LlmRoute,
    input: {
      mode: TaskMode;
      messages: { role: "system" | "user" | "assistant"; content: string }[];
      json?: boolean;
    },
  ): Promise<LlmCompleteResult> {
    const client = createOpenAIClient(route.apiKey);
    const completion = await client.chat.completions.create({
      model: route.model,
      messages: input.messages,
      temperature: input.mode === "final" ? 0.4 : 0.7,
      ...(input.json ? { response_format: { type: "json_object" as const } } : {}),
    });

    const text = completion.choices[0]?.message?.content?.trim() || "";
    const tokens =
      completion.usage?.total_tokens ??
      Math.ceil(text.split(/\s+/).length * 1.3);

    return {
      text,
      tokens,
      model: route.model,
      provider: "openai",
      demo: false,
    };
  }

  private async completeAnthropic(
    route: LlmRoute,
    input: {
      mode: TaskMode;
      messages: { role: "system" | "user" | "assistant"; content: string }[];
      json?: boolean;
    },
  ): Promise<LlmCompleteResult> {
    const client = createAnthropicClient(route.apiKey);
    const system = input.messages
      .filter((message) => message.role === "system")
      .map((message) => message.content)
      .join("\n\n");
    const jsonHint = input.json
      ? "\n\nRespond with a single JSON object only. No markdown fence."
      : "";

    const conversation = input.messages
      .filter((message) => message.role !== "system")
      .map((message) => ({
        role: message.role as "user" | "assistant",
        content: message.content,
      }));

    const response = await client.messages.create({
      model: route.model,
      max_tokens: 4096,
      temperature: input.mode === "final" ? 0.4 : 0.7,
      system: `${system}${jsonHint}`.trim() || undefined,
      messages: conversation,
    });

    const text = textFromAnthropic(response.content);
    const tokens =
      (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0);

    return {
      text,
      tokens: tokens || Math.ceil(text.split(/\s+/).length * 1.3),
      model: route.model,
      provider: "anthropic",
      demo: false,
    };
  }

  private async completeGemini(
    route: LlmRoute,
    input: {
      mode: TaskMode;
      messages: { role: "system" | "user" | "assistant"; content: string }[];
      json?: boolean;
    },
  ): Promise<LlmCompleteResult> {
    const client = createGeminiClient(route.apiKey);
    const system = input.messages
      .filter((message) => message.role === "system")
      .map((message) => message.content)
      .join("\n\n");
    const jsonHint = input.json
      ? "\n\nRespond with a single JSON object only. No markdown fence."
      : "";

    const contents = input.messages
      .filter((message) => message.role !== "system")
      .map((message) => ({
        role: message.role === "assistant" ? "model" : "user",
        parts: [{ text: message.content }],
      }));

    const response = await client.models.generateContent({
      model: route.model,
      contents,
      config: {
        systemInstruction: `${system}${jsonHint}`.trim() || undefined,
        temperature: input.mode === "final" ? 0.4 : 0.7,
        ...(input.json ? { responseMimeType: "application/json" } : {}),
      },
    });

    const text = (response.text || "").trim();
    const usage = response.usageMetadata;
    const tokens =
      (usage?.promptTokenCount ?? 0) + (usage?.candidatesTokenCount ?? 0);

    return {
      text,
      tokens: tokens || Math.ceil(text.split(/\s+/).length * 1.3),
      model: route.model,
      provider: "gemini",
      demo: false,
    };
  }

  private async completeXai(
    route: LlmRoute,
    input: {
      mode: TaskMode;
      messages: { role: "system" | "user" | "assistant"; content: string }[];
      json?: boolean;
    },
  ): Promise<LlmCompleteResult> {
    const client = createXaiClient(route.apiKey);
    const completion = await client.chat.completions.create({
      model: route.model,
      messages: input.messages,
      temperature: input.mode === "final" ? 0.4 : 0.7,
      ...(input.json ? { response_format: { type: "json_object" as const } } : {}),
    });

    const text = completion.choices[0]?.message?.content?.trim() || "";
    const tokens =
      completion.usage?.total_tokens ??
      Math.ceil(text.split(/\s+/).length * 1.3);

    return {
      text,
      tokens,
      model: route.model,
      provider: "xai",
      demo: false,
    };
  }
}

export const llm = new LLMProvider();
