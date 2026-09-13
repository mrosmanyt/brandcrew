import { AsyncLocalStorage } from "node:async_hooks";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import { normalizePlanId, planForcesCheapBackends } from "@/lib/limits";
import {
  contentHasMedia,
  contentHasNonImageMedia,
  textOfContent,
  type LlmMessageContent,
} from "@/lib/composer-media";
import { messagesWithLanguagePolicy } from "@/lib/language-policy";
import {
  displayModelById,
  geminiFlashModelId,
  gptTerraModelId,
  haikuModelId,
  publicModelLabel,
  sonnetMaxModelId,
  sonnetModelId,
} from "@/lib/model-catalog";
import {
  normalizeModelRouting,
  type LlmRoutingPreference,
  type LlmStatus,
} from "@/lib/llm-routing";
import { anthropicCachedSystem, promptCacheForProvider } from "@/lib/prompt-cache";

export type { LlmRoutingPreference, LlmStatus } from "@/lib/llm-routing";
export { normalizeModelRouting } from "@/lib/llm-routing";

export type TaskMode = "draft" | "final";

type RoutingStore = {
  prefer: LlmRoutingPreference;
  plan: string;
  boost: boolean;
  workspaceId?: string;
  budgetMode?: "llm" | "chat";
};

const routingAls = new AsyncLocalStorage<RoutingStore>();

export function currentRoutingPreference(): LlmRoutingPreference {
  return routingAls.getStore()?.prefer ?? "auto";
}

export function currentRoutingPlan(): string {
  return routingAls.getStore()?.plan ?? "";
}

export function currentRoutingBoost(): boolean {
  return routingAls.getStore()?.boost ?? false;
}

export function currentRoutingWorkspaceId(): string {
  return routingAls.getStore()?.workspaceId ?? "";
}

export function currentRoutingBudgetMode(): "llm" | "chat" {
  return routingAls.getStore()?.budgetMode ?? "llm";
}

export function runWithLlmRouting<T>(
  input: {
    prefer?: string | null;
    plan?: string | null;
    boost?: boolean;
    workspaceId?: string | null;
    budgetMode?: "llm" | "chat";
  },
  fn: () => T,
): T {
  const prev = routingAls.getStore();
  return routingAls.run(
    {
      prefer: normalizeModelRouting(input.prefer ?? prev?.prefer),
      plan: input.plan ?? prev?.plan ?? "",
      boost: input.boost ?? prev?.boost ?? false,
      workspaceId: input.workspaceId ?? prev?.workspaceId,
      budgetMode: input.budgetMode ?? prev?.budgetMode ?? "llm",
    },
    fn,
  );
}

export function runWithRoutingPreference<T>(
  prefer: LlmRoutingPreference | string | null | undefined,
  fn: () => T,
): T {
  return runWithLlmRouting({ prefer }, fn);
}

/**
 * Job-family routing when the desk does not pick a display model.
 * Cheap backends only — see `src/lib/model-catalog.ts`.
 */
export type LlmJobKind =
  | "website"
  | "coding"
  | "posts"
  | "apps"
  | "general"
  | "research"
  | "outreach"
  | "whatsapp"
  | "summaries"
  | "json"
  | "classify"
  | "code"
  | "boost";

export type LlmProviderName = "openai" | "anthropic" | "gemini" | "xai" | "demo";

export type LlmRoute = {
  provider: "openai" | "anthropic" | "gemini" | "xai";
  model: string;
  apiKey: string;
};

export type LlmCompleteResult = {
  text: string;
  tokens: number;
  model: string;
  displayName: string;
  provider: LlmProviderName;
  demo: boolean;
  promptCached?: boolean;
};

export type LlmChatMessage = {
  role: "system" | "user" | "assistant";
  content: LlmMessageContent;
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
  return gptTerraModelId();
}

export function openaiFinalModel() {
  return process.env.OPENAI_FINAL_MODEL || "gpt-4.1";
}

export function anthropicDraftModel() {
  return haikuModelId();
}

export function anthropicFinalModel() {
  return sonnetModelId();
}

export function geminiDraftModel() {
  return geminiFlashModelId();
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

function geminiFlashRoute(): LlmRoute | null {
  const key = geminiKey();
  if (!key) return null;
  return { provider: "gemini", model: geminiFlashModelId(), apiKey: key };
}

function openaiTerraRoute(): LlmRoute | null {
  const key = openaiKey();
  if (!key) return null;
  return { provider: "openai", model: gptTerraModelId(), apiKey: key };
}

function anthropicHaikuRoute(): LlmRoute | null {
  const key = anthropicKey();
  if (!key) return null;
  return { provider: "anthropic", model: haikuModelId(), apiKey: key };
}

function anthropicSonnetRoute(max = false): LlmRoute | null {
  const key = anthropicKey();
  if (!key) return null;
  return {
    provider: "anthropic",
    model: max ? sonnetMaxModelId() : sonnetModelId(),
    apiKey: key,
  };
}

function xaiRoute(): LlmRoute | null {
  const key = xaiKey();
  if (!key) return null;
  return { provider: "xai", model: xaiPostsModel(), apiKey: key };
}

const CHEAP_FALLBACKS = [
  geminiFlashRoute,
  openaiTerraRoute,
  anthropicHaikuRoute,
  xaiRoute,
];

function firstCheap(extra: Array<LlmRoute | null> = []): LlmRoute | null {
  return firstRoute([...extra, ...CHEAP_FALLBACKS.map((fn) => fn())]);
}

function isFlashKind(kind: LlmJobKind) {
  return (
    kind === "website" ||
    kind === "research" ||
    kind === "outreach" ||
    kind === "whatsapp" ||
    kind === "summaries" ||
    kind === "posts"
  );
}

function isCodeKind(kind: LlmJobKind) {
  return kind === "coding" || kind === "apps" || kind === "code";
}

function isJsonKind(kind: LlmJobKind, json: boolean) {
  return kind === "json" || (json && kind === "general");
}

/** Locator / classification — cheapest live engine, never Sonnet. */
function isClassifyKind(kind: LlmJobKind) {
  return kind === "classify";
}

function wantsSonnetMax(kind: LlmJobKind, plan: string, boost: boolean) {
  return boost || kind === "boost" || normalizePlanId(plan) === "ultra";
}

function isExpensiveRoute(route: LlmRoute | null): boolean {
  if (!route) return false;
  if (route.provider === "anthropic" && /sonnet/i.test(route.model)) return true;
  if (route.provider === "openai" && /gpt-4\.1(?!-mini)|gpt-4o(?!-mini)|o[1-4]\b/i.test(route.model)) {
    return true;
  }
  if (route.provider === "gemini" && /pro/i.test(route.model) && !/flash/i.test(route.model)) {
    return true;
  }
  return false;
}

/**
 * Auto (no UI model pick):
 * - Free / Pro (internal starter id) → cheapest live (Gemini Flash, else gpt-4o-mini). Never Sonnet.
 * - research / outreach / WhatsApp / summaries / website → Gemini Flash
 * - structured JSON / short tools → Haiku (Pro Plus / Ultra)
 * - code / complex apps → Sonnet (Pro Plus / Ultra only)
 * - Ultra or Boost → Sonnet max (never Opus)
 */
function pickRouteDefault(
  kind: LlmJobKind,
  json: boolean,
  plan: string,
  boost: boolean,
): LlmRoute | null {
  if (planForcesCheapBackends(plan)) {
    return firstCheap();
  }
  if (wantsSonnetMax(kind, plan, boost)) {
    return firstCheap([anthropicSonnetRoute(true)]);
  }
  if (isCodeKind(kind)) {
    return firstCheap([anthropicSonnetRoute()]);
  }
  if (isClassifyKind(kind)) {
    return firstCheap();
  }
  if (isJsonKind(kind, json)) {
    return firstCheap([anthropicHaikuRoute()]);
  }
  if (isFlashKind(kind) || kind === "general") {
    return firstCheap([geminiFlashRoute()]);
  }
  return firstCheap();
}

function catalogRoute(prefer: LlmRoutingPreference): LlmRoute | null {
  const row = displayModelById(prefer);
  if (!row) return null;
  if (row.backendClass === "haiku") return firstCheap([anthropicHaikuRoute()]);
  if (row.backendClass === "sonnet") return firstCheap([anthropicSonnetRoute()]);
  if (row.backendClass === "sonnet-max") return firstCheap([anthropicSonnetRoute(true)]);
  if (row.backendClass === "terra") return firstCheap([openaiTerraRoute()]);
  if (row.backendClass === "flash") return firstCheap([geminiFlashRoute()]);
  return null;
}

/**
 * Display-model catalog first; otherwise task-based cheap routing.
 * Picked UI names resolve to Haiku / Sonnet / GPT Terra / Gemini Flash.
 * Free + Pro (internal starter id) never take Sonnet / Gemini Pro finals even if the picker says Fable.
 */
export function pickRoute(
  mode: TaskMode,
  kind: LlmJobKind = "general",
  prefer: LlmRoutingPreference | string = currentRoutingPreference(),
  extras?: { json?: boolean; plan?: string; boost?: boolean },
): LlmRoute | null {
  void mode;
  const catalogId = normalizeModelRouting(prefer);
  const json = extras?.json ?? false;
  const plan = extras?.plan ?? currentRoutingPlan();
  const boost = extras?.boost ?? currentRoutingBoost();
  const cheapPlan = planForcesCheapBackends(plan);
  const chosen = catalogRoute(catalogId);
  if (chosen && !(cheapPlan && isExpensiveRoute(chosen))) return chosen;
  return pickRouteDefault(kind, json, plan, boost);
}

function routeKey(route: LlmRoute) {
  return `${route.provider}:${route.model}`;
}

/**
 * Preferred route first, then remaining cheap backends (Gemini Flash, GPT Terra,
 * Haiku, xAI). Used so a missing/failing OpenAI or Anthropic key still reaches
 * Gemini when GEMINI_API_KEY is set — never a demo English-only stub.
 */
export function completeRouteCandidates(
  mode: TaskMode,
  kind: LlmJobKind = "general",
  prefer: LlmRoutingPreference | string = currentRoutingPreference(),
  extras?: { json?: boolean; plan?: string; boost?: boolean },
): LlmRoute[] {
  const primary = pickRoute(mode, kind, prefer, extras);
  const cheap = CHEAP_FALLBACKS.map((fn) => fn()).filter((row): row is LlmRoute => Boolean(row));
  const out: LlmRoute[] = [];
  const seen = new Set<string>();
  for (const route of primary ? [primary, ...cheap] : cheap) {
    const key = routeKey(route);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(route);
  }
  return out;
}

export function isRetryableLlmProviderError(error: unknown): boolean {
  if (!error) return false;
  if (error instanceof Error && error.name === "BudgetError") return false;
  if (error instanceof Error && error.message === "NO_LLM_KEYS") return false;
  return true;
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

function skippedMediaNote(content: LlmMessageContent): string {
  if (typeof content === "string") return "";
  const kinds = content
    .filter((part) => part.type === "audio" || part.type === "video")
    .map((part) => (part.type === "audio" ? "voice note" : "short video clip"));
  if (!kinds.length) return "";
  return `\n\n(Attached ${[...new Set(kinds)].join(" and ")} — analyze from the transcript or caption above. This backend cannot play the raw bytes.)`;
}

function openaiChatMessage(message: LlmChatMessage): OpenAI.Chat.ChatCompletionMessageParam {
  if (typeof message.content === "string") {
    return { role: message.role, content: message.content } as OpenAI.Chat.ChatCompletionMessageParam;
  }
  const blocks: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } }
  > = [];
  for (const part of message.content) {
    if (part.type === "text") {
      blocks.push({ type: "text", text: part.text });
    } else if (part.type === "image") {
      blocks.push({
        type: "image_url",
        image_url: { url: `data:${part.mime};base64,${part.data}` },
      });
    }
  }
  const note = skippedMediaNote(message.content);
  if (note) {
    blocks.push({ type: "text", text: note.trim() });
  }
  if (!blocks.length) {
    return {
      role: message.role,
      content: textOfContent(message.content),
    } as OpenAI.Chat.ChatCompletionMessageParam;
  }
  return { role: message.role, content: blocks } as OpenAI.Chat.ChatCompletionMessageParam;
}

function anthropicMessageContent(
  content: LlmMessageContent,
): string | Anthropic.MessageCreateParams["messages"][number]["content"] {
  if (typeof content === "string") return content;
  const blocks: Anthropic.ContentBlockParam[] = [];
  for (const part of content) {
    if (part.type === "text") {
      blocks.push({ type: "text", text: part.text });
    } else if (part.type === "image") {
      const mediaType = part.mime === "image/jpg" ? "image/jpeg" : part.mime;
      if (
        mediaType === "image/jpeg" ||
        mediaType === "image/png" ||
        mediaType === "image/gif" ||
        mediaType === "image/webp"
      ) {
        blocks.push({
          type: "image",
          source: { type: "base64", media_type: mediaType, data: part.data },
        });
      }
    }
  }
  const note = skippedMediaNote(content);
  if (note) blocks.push({ type: "text", text: note.trim() });
  return blocks.length ? blocks : textOfContent(content);
}

function geminiParts(content: LlmMessageContent): Array<
  | { text: string }
  | { inlineData: { mimeType: string; data: string } }
> {
  if (typeof content === "string") {
    return [{ text: content }];
  }
  const parts: Array<
    | { text: string }
    | { inlineData: { mimeType: string; data: string } }
  > = [];
  for (const part of content) {
    if (part.type === "text") {
      parts.push({ text: part.text });
    } else {
      parts.push({ inlineData: { mimeType: part.mime, data: part.data } });
    }
  }
  return parts.length ? parts : [{ text: textOfContent(content) }];
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
    messages: LlmChatMessage[];
    json?: boolean;
  }): Promise<LlmCompleteResult> {
    const workspaceId = currentRoutingWorkspaceId();
    if (workspaceId) {
      const { assertLlmCallBudget } = await import("@/lib/usage");
      await assertLlmCallBudget(workspaceId, currentRoutingBudgetMode());
    }
    const kind = input.kind ?? "general";
    const payload = {
      ...input,
      messages: messagesWithLanguagePolicy(input.messages, kind) as LlmChatMessage[],
    };
    const media = payload.messages.some((row) => contentHasMedia(row.content));
    const needsNativeMedia = payload.messages.some((row) =>
      contentHasNonImageMedia(row.content),
    );
    let candidates = completeRouteCandidates(input.mode, kind, currentRoutingPreference(), {
      json: input.json,
    });
    if (media) {
      const flash = geminiFlashRoute();
      if (flash) {
        const key = routeKey(flash);
        candidates = [flash, ...candidates.filter((row) => routeKey(row) !== key)];
      } else if (needsNativeMedia) {
        // Audio/video stay on Gemini when keyed; otherwise providers get a text note.
      }
    }
    if (!candidates.length) {
      throw new Error("NO_LLM_KEYS");
    }

    let lastError: unknown;
    for (const route of candidates) {
      try {
        return await this.completeOnRoute(route, payload);
      } catch (error) {
        if (!isRetryableLlmProviderError(error)) throw error;
        lastError = error;
      }
    }
    throw lastError instanceof Error ? lastError : new Error("NO_LLM_KEYS");
  }

  private async completeOnRoute(
    route: LlmRoute,
    input: {
      mode: TaskMode;
      messages: LlmChatMessage[];
      json?: boolean;
    },
  ): Promise<LlmCompleteResult> {
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
      messages: LlmChatMessage[];
      json?: boolean;
    },
  ): Promise<LlmCompleteResult> {
    const client = createOpenAIClient(route.apiKey);
    const completion = await client.chat.completions.create({
      model: route.model,
      messages: input.messages.map((message) => openaiChatMessage(message)),
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
      displayName: publicModelLabel(route.model),
      provider: "openai",
      demo: false,
      promptCached: promptCacheForProvider("openai").enabled,
    };
  }

  private async completeAnthropic(
    route: LlmRoute,
    input: {
      mode: TaskMode;
      messages: LlmChatMessage[];
      json?: boolean;
    },
  ): Promise<LlmCompleteResult> {
    const client = createAnthropicClient(route.apiKey);
    const system = input.messages
      .filter((message) => message.role === "system")
      .map((message) => textOfContent(message.content))
      .join("\n\n");
    const jsonHint = input.json
      ? "\n\nRespond with a single JSON object only. No markdown fence."
      : "";

    const conversation = input.messages
      .filter((message) => message.role !== "system")
      .map((message) => ({
        role: message.role as "user" | "assistant",
        content: anthropicMessageContent(message.content),
      }));

    const systemText = `${system}${jsonHint}`.trim();
    const response = await client.messages.create({
      model: route.model,
      max_tokens: 4096,
      temperature: input.mode === "final" ? 0.4 : 0.7,
      system: systemText ? anthropicCachedSystem(systemText) : undefined,
      messages: conversation,
    });

    const text = textFromAnthropic(response.content);
    const tokens =
      (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0);

    return {
      text,
      tokens: tokens || Math.ceil(text.split(/\s+/).length * 1.3),
      model: route.model,
      displayName: publicModelLabel(route.model),
      provider: "anthropic",
      demo: false,
      promptCached: promptCacheForProvider("anthropic").enabled,
    };
  }

  private async completeGemini(
    route: LlmRoute,
    input: {
      mode: TaskMode;
      messages: LlmChatMessage[];
      json?: boolean;
    },
  ): Promise<LlmCompleteResult> {
    const client = createGeminiClient(route.apiKey);
    const system = input.messages
      .filter((message) => message.role === "system")
      .map((message) => textOfContent(message.content))
      .join("\n\n");
    const jsonHint = input.json
      ? "\n\nRespond with a single JSON object only. No markdown fence."
      : "";

    const contents = input.messages
      .filter((message) => message.role !== "system")
      .map((message) => ({
        role: message.role === "assistant" ? "model" : "user",
        parts: geminiParts(message.content),
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
      displayName: publicModelLabel(route.model),
      provider: "gemini",
      demo: false,
      promptCached: promptCacheForProvider("gemini").enabled,
    };
  }

  private async completeXai(
    route: LlmRoute,
    input: {
      mode: TaskMode;
      messages: LlmChatMessage[];
      json?: boolean;
    },
  ): Promise<LlmCompleteResult> {
    const client = createXaiClient(route.apiKey);
    const completion = await client.chat.completions.create({
      model: route.model,
      messages: input.messages.map((message) => openaiChatMessage(message)),
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
      displayName: publicModelLabel(route.model),
      provider: "xai",
      demo: false,
      promptCached: promptCacheForProvider("xai").enabled,
    };
  }
}

export const llm = new LLMProvider();
