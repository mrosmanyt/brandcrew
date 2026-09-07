import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";

export type TaskMode = "draft" | "final";

export type LlmProviderName = "openai" | "anthropic" | "gemini" | "demo";

export type LlmStatus = {
  openai: boolean;
  anthropic: boolean;
  gemini: boolean;
  configured: boolean;
  mode: "live" | "demo";
};

export type LlmRoute = {
  provider: "openai" | "anthropic" | "gemini";
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

export function hasOpenAI() {
  return Boolean(openaiKey());
}

export function hasAnthropic() {
  return Boolean(anthropicKey());
}

export function hasGemini() {
  return Boolean(geminiKey());
}

export function getLlmStatus(): LlmStatus {
  const openai = hasOpenAI();
  const anthropic = hasAnthropic();
  const gemini = hasGemini();
  const configured = openai || anthropic || gemini;
  return {
    openai,
    anthropic,
    gemini,
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

/**
 * Router policy (xAI / Grok skipped):
 * - One provider only → that provider for drafts and finals.
 * - Drafts: cheap model. Prefer Gemini Flash, else OpenAI mini, else Claude Haiku.
 * - Finals: stronger model. Prefer Claude Sonnet, else GPT-4.1-class, else Gemini Pro.
 */
export function pickRoute(mode: TaskMode): LlmRoute | null {
  const openai = openaiKey();
  const anthropic = anthropicKey();
  const gemini = geminiKey();
  if (!openai && !anthropic && !gemini) return null;

  if (mode === "draft") {
    if (gemini) {
      return { provider: "gemini", model: geminiDraftModel(), apiKey: gemini };
    }
    if (openai) {
      return { provider: "openai", model: openaiDraftModel(), apiKey: openai };
    }
    return {
      provider: "anthropic",
      model: anthropicDraftModel(),
      apiKey: anthropic,
    };
  }

  if (anthropic) {
    return {
      provider: "anthropic",
      model: anthropicFinalModel(),
      apiKey: anthropic,
    };
  }
  if (openai) {
    return { provider: "openai", model: openaiFinalModel(), apiKey: openai };
  }
  return { provider: "gemini", model: geminiFinalModel(), apiKey: gemini };
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

  pickModel(mode: TaskMode) {
    return pickRoute(mode);
  }

  async complete(input: {
    mode: TaskMode;
    messages: { role: "system" | "user" | "assistant"; content: string }[];
    json?: boolean;
  }): Promise<LlmCompleteResult> {
    const route = pickRoute(input.mode);
    if (!route) {
      throw new Error("NO_LLM_KEYS");
    }

    if (route.provider === "anthropic") {
      return this.completeAnthropic(route, input);
    }
    if (route.provider === "gemini") {
      return this.completeGemini(route, input);
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
}

export const llm = new LLMProvider();
