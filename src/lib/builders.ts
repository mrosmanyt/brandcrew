import { brandKitBrief, brandLabel, type BrandKit } from "@/lib/brand-kit";
import { displayAgentName } from "@/lib/constants";
import { demoAppHtml, demoDeckHtml, demoWebsiteHtml } from "@/lib/demo";
import { replitHookConfigured } from "@/lib/html-preview";
import { parseLlmJson } from "@/lib/job-serialize";
import { llm, type LlmJobKind } from "@/lib/llm";
import { resolveRunOutput } from "@/lib/live-output";

export type BuilderKind = "website" | "app" | "deck";

export type BuilderArtifact = {
  type: BuilderKind;
  title: string;
  summary: string;
  content: string;
  tokens: number;
  model: string;
  provider: string;
  demo: boolean;
};

function builderKind(kind: BuilderKind): LlmJobKind {
  return kind === "app" ? "apps" : "website";
}

function fallback(kind: BuilderKind, kit: BrandKit): Omit<BuilderArtifact, "tokens" | "model" | "provider" | "demo"> {
  if (kind === "app") {
    return {
      type: "app",
      title: `${brandLabel(kit)} mini app`,
      summary: "Offline demo app HTML. Preview runs in the desk — no Replit login.",
      content: demoAppHtml(kit),
    };
  }
  if (kind === "deck") {
    return {
      type: "deck",
      title: `${brandLabel(kit)} deck`,
      summary: "Offline demo pitch deck HTML. Preview runs in the desk.",
      content: demoDeckHtml(kit),
    };
  }
  return {
    type: "website",
    title: `${brandLabel(kit)} site`,
    summary: "Offline demo landing page HTML. Preview runs in the desk.",
    content: demoWebsiteHtml(kit),
  };
}

function extractHtml(text: string): string {
  const parsed = parseLlmJson(text);
  const fromJson = String(parsed?.html || parsed?.content || "").trim();
  if (fromJson && /<html|<div|<section/i.test(fromJson)) return fromJson;
  const fence = text.match(/```(?:html|htm)?\s*([\s\S]*?)```/i);
  if (fence?.[1]?.trim()) return fence[1].trim();
  if (/<!doctype html|<html[\s>]/i.test(text)) return text.trim();
  return "";
}

export async function generateBuilderArtifact(input: {
  kind: BuilderKind;
  kit: BrandKit;
  prompt: string;
  agentName?: string;
  agentInstructions?: string;
}): Promise<BuilderArtifact> {
  const live = llm.isLiveFor(builderKind(input.kind));
  const canned = fallback(input.kind, input.kit);
  if (!live) {
    return { ...canned, tokens: 0, model: "demo", provider: "demo", demo: true };
  }

  const name = displayAgentName(input.agentName);
  const replitNote = replitHookConfigured()
    ? "A server REPLIT_CONNECT_URL is set — mention it as an optional later deploy hook, not as a completed publish."
    : "Do not mention Replit, Vercel deploy, or a live URL. Preview is an iframe in CINEM Pro.";

  const result = await llm.complete({
    mode: "draft",
    kind: builderKind(input.kind),
    json: true,
    messages: [
      {
        role: "system",
        content: `You are ${name} on CINEM Pro, a ${
          input.kind === "app" ? "app" : input.kind === "deck" ? "pitch-deck" : "website"
        } builder.
${input.agentInstructions || ""}
Return one self-contained HTML document. No markdown outside JSON.
No external scripts or tracking. CSS in a <style> tag. Vanilla JS only if needed for a tiny app.
${input.kind === "deck" ? "Use 5–7 full-viewport sections as slides. CSS only — no script for slide changes." : ""}
Do not publish or claim the site is live.
${replitNote}

Brand Kit:
${brandKitBrief(input.kit)}

Respond as JSON:
{
  "title": string,
  "summary": string,
  "html": string (complete HTML document)
}`,
      },
      {
        role: "user",
        content:
          input.prompt ||
          (input.kind === "app"
            ? "Build a small branded web app the user can preview in the desk."
            : input.kind === "deck"
              ? "Build a short branded pitch deck the user can preview in the desk."
              : "Build a one-page branded website the user can preview in the desk."),
      },
    ],
  });

  const parsed = parseLlmJson(result.text);
  const html = extractHtml(result.text);
  const resolved = resolveRunOutput({
    live: true,
    llmTitle: String(parsed?.title || canned.title),
    llmContent: html,
    demoTitle: canned.title,
    demoContent: "",
  });

  return {
    type: input.kind,
    title: resolved.title,
    summary: String(parsed?.summary || "").trim(),
    content: resolved.content,
    tokens: result.tokens,
    model: result.model,
    provider: result.provider,
    demo: false,
  };
}
