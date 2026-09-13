import type { AgentRole, GenerateAction } from "@/lib/constants";
import { displayAgentName } from "@/lib/constants";
import { brandKitBrief, brandLabel, type BrandKit } from "@/lib/brand-kit";
import {
  demoAdAnglesFromUrl,
  demoAppHtml,
  demoArtifact,
  demoBrandKitDraft,
  demoCompetitorMarkdown,
  demoDeckHtml,
  demoGenerateWeek,
  demoOutreachFromResearch,
  demoResearchPack,
  demoSalesPack,
  demoWebsiteHtml,
} from "@/lib/demo";
import { generateBuilderArtifact } from "@/lib/builders";
import { mergeTextAndAttachments } from "@/lib/composer-media";
import { withLanguagePolicy } from "@/lib/language-policy";
import { llm, type LlmJobKind, type TaskMode } from "@/lib/llm";
import { resolveRunOutput } from "@/lib/live-output";
import { parseLlmJson } from "@/lib/job-serialize";
import type { GeneratedArtifact } from "@/lib/agents-types";

export type { GeneratedArtifact } from "@/lib/agents-types";

const ROLE_INSTRUCTIONS: Record<AgentRole, string> = {
  strategist: `Return one strategy brief. Sections: Ideal customer (ICP), Offer, three monthly content pillars, and What not to say.`,
  writer: `Return drafts in Brand Kit voice. Do not use forbidden words. Do not publish.`,
  researcher: `Return sourced notes: URL, what the page actually says, implications, what not to copy. No invented quotes.`,
  distributor: `Return a 30-day content calendar starting tomorrow with a Markdown table and a calendar array.`,
  sales: `Return outbound scripts. No CRM fields. Do not send.`,
  ads: `Return ad angles with primary text. State that CINEM Pro does not buy media.`,
  ops: `Return a short ops plan and a tasks array of items with status approve|schedule|done.`,
  builder: `Return a complete HTML document for a website or small app. No external scripts. Do not publish.`,
};

export function agentMode(role: AgentRole, action: GenerateAction = "default"): TaskMode {
  if (
    action === "generate_week" ||
    action === "sales_pack" ||
    action === "research_pack" ||
    action === "competitor_scan" ||
    action === "outreach_from_research" ||
    action === "ad_angles_from_url" ||
    action === "build_website" ||
    action === "build_app" ||
    action === "build_deck" ||
    action === "brand_kit_draft"
  ) {
    return "draft";
  }
  return role === "strategist" || role === "ads" ? "final" : "draft";
}

function actionInstructions(action: GenerateAction, role: AgentRole) {
  if (action === "generate_week") {
    return `Write LinkedIn posts in Brand Kit voice. Return Markdown. Also a calendar array if useful. Do not publish.`;
  }
  if (action === "sales_pack") {
    return `Write outbound emails and LinkedIn DMs. Do not send.`;
  }
  if (action === "research_pack") {
    return `Write sourced notes from the Brand Kit and any browsed page text. Do not invent quotes.`;
  }
  if (action === "competitor_scan") {
    return `Write a competitor comparison from browsed pages only. One section per URL. No invented quotes.`;
  }
  if (action === "outreach_from_research") {
    return `Write 5 LinkedIn DMs grounded in the research artifact when present. Do not send.`;
  }
  if (action === "ad_angles_from_url") {
    return `Write 5 ad angles from the landing page. Creative only — no media buy.`;
  }
  if (action === "build_website") {
    return `Return a complete HTML landing page in Brand Kit voice. CSS in a style tag. Do not publish.`;
  }
  if (action === "build_app") {
    return `Return a complete HTML mini-app. No Replit. No external login. CSS in a style tag.`;
  }
  if (action === "build_deck") {
    return `Return a complete HTML pitch deck (5–7 full-viewport slides). CSS only. Do not publish.`;
  }
  if (action === "brand_kit_draft") {
    return `Write Brand Kit creative: voice, visual direction, headline options, and what not to say. Markdown. Do not publish.`;
  }
  return ROLE_INSTRUCTIONS[role];
}

export function systemPrompt(
  role: AgentRole,
  kit: BrandKit,
  action: GenerateAction = "default",
  agentName = "New Agent",
  agentInstructions = "",
) {
  return withLanguagePolicy(`You are ${displayAgentName(agentName)} on CINEM Pro — CINEM Pro's AI.
${agentInstructions || `Role label: ${role}.`}
You share one Brand Kit. Produce ONE artifact. Never send, publish, or spend.
Prefer this agent's niche, but do not refuse basic helpful answers. Mirror the user's language.

Brand Kit:
${brandKitBrief(kit)}

${actionInstructions(action, role)}

Respond as JSON:
{
  "title": string,
  "summary": string,
  "content": string (Markdown),
  "calendar": optional array,
  "tasks": optional array
}`);
}

function fallbackArtifact(
  role: AgentRole,
  kit: BrandKit,
  action: GenerateAction,
): GeneratedArtifact {
  if (action === "generate_week") return demoGenerateWeek(kit);
  if (action === "sales_pack") return demoSalesPack(kit);
  if (action === "research_pack") return demoResearchPack(kit);
  if (action === "competitor_scan") {
    return {
      type: "competitor_scan",
      title: "Competitor scan",
      summary: "Read-only comparison of public pages.",
      content: demoCompetitorMarkdown(kit),
    };
  }
  if (action === "outreach_from_research") return demoOutreachFromResearch(kit);
  if (action === "ad_angles_from_url") return demoAdAnglesFromUrl(kit);
  if (action === "build_app") {
    return {
      type: "app",
      title: `${brandLabel(kit)} mini app`,
      summary: "Offline template app HTML.",
      content: demoAppHtml(kit),
    };
  }
  if (action === "build_deck") {
    return {
      type: "deck",
      title: `${brandLabel(kit)} deck`,
      summary: "Offline template pitch deck HTML.",
      content: demoDeckHtml(kit),
    };
  }
  if (action === "brand_kit_draft") return demoBrandKitDraft(kit);
  if (action === "build_website" || role === "builder") {
    return {
      type: "website",
      title: `${brandLabel(kit)} site`,
      summary: "Offline template landing page.",
      content: demoWebsiteHtml(kit),
    };
  }
  return demoArtifact(role, kit);
}

function parseLiveArtifact(
  text: string,
  role: AgentRole,
  action: GenerateAction = "default",
): GeneratedArtifact {
  const type =
    action === "brand_kit_draft"
      ? "brand_kit_draft"
      : action === "build_deck"
        ? "deck"
        : role === "researcher"
          ? "research_pack"
          : role === "sales"
            ? "sales_pack"
            : role === "ads"
              ? "ad_angles"
              : role === "ops"
                ? "ops_board"
                : role === "builder"
                  ? "website"
                  : "draft";
  const parsed = parseLlmJson(text);
  if (parsed) {
    const content = String(parsed.content || "").trim();
    if (content) {
      return {
        type,
        title: String(parsed.title || "Draft"),
        summary: String(parsed.summary || ""),
        content,
        calendar: Array.isArray(parsed.calendar) ? parsed.calendar : undefined,
        tasks: Array.isArray(parsed.tasks) ? parsed.tasks : undefined,
      };
    }
  }
  if (text.trim()) {
    return {
      type,
      title: "Draft",
      summary: "",
      content: text.trim(),
    };
  }
  throw new Error("Live job produced no model output.");
}

export async function generateAgentArtifact(input: {
  role: AgentRole;
  kit: BrandKit;
  userMessage: string;
  history: { role: "user" | "assistant"; content: string }[];
  action?: GenerateAction;
  agentName?: string;
  agentInstructions?: string;
  attachments?: import("@/lib/composer").ComposerAttachment[];
}): Promise<{
  artifact: GeneratedArtifact;
  assistantText: string;
  tokens: number;
  model: string;
  provider: string;
  demo: boolean;
}> {
  const action = input.action ?? "default";
  const mode = agentMode(input.role, action);
  const kind = jobKindFor(input.role, action);
  const name = displayAgentName(input.agentName);

  if (action === "build_website" || action === "build_app" || action === "build_deck") {
    const built = await generateBuilderArtifact({
      kind: action === "build_app" ? "app" : action === "build_deck" ? "deck" : "website",
      kit: input.kit,
      prompt: input.userMessage,
      agentName: input.agentName,
      agentInstructions: input.agentInstructions,
      attachments: input.attachments,
    });
    return {
      artifact: {
        type: built.type,
        title: built.title,
        summary: built.summary,
        content: built.content,
      },
      assistantText: built.summary
        ? `${built.summary}\n\nPreview **${built.title}** in the desk sidebar.`
        : `Preview **${built.title}** in the desk sidebar.`,
      tokens: built.tokens,
      model: built.model,
      provider: built.provider,
      demo: built.demo,
    };
  }

  if (!llm.isLiveFor(kind)) {
    const artifact = fallbackArtifact(input.role, input.kit, action);
    const assistantText = `${artifact.summary}\n\n(Offline template draft — add OPENAI_API_KEY, ANTHROPIC_API_KEY, GEMINI_API_KEY, or XAI_API_KEY on the server. This template is not live work.)`;
    return {
      artifact,
      assistantText,
      tokens: 0,
      model: "demo",
      provider: "demo",
      demo: true,
    };
  }

  const result = await llm.complete({
    mode,
    kind,
    json: true,
    messages: [
      {
        role: "system",
        content: systemPrompt(
          input.role,
          input.kit,
          action,
          name,
          input.agentInstructions || "",
        ),
      },
      ...input.history.slice(-8).map((m) => ({
        role: m.role,
        content: m.content,
      })),
      { role: "user", content: mergeTextAndAttachments(input.userMessage, input.attachments) },
    ],
  });
  const artifact = parseLiveArtifact(result.text, input.role, action);
  const resolved = resolveRunOutput({
    live: true,
    llmTitle: artifact.title,
    llmContent: artifact.content,
    demoTitle: "Draft",
    demoContent: "",
  });
  artifact.title = resolved.title;
  artifact.content = resolved.content;
  const assistantText = artifact.summary
    ? `${artifact.summary}\n\nI drafted **${artifact.title}**. Approve it when you want to keep it.`
    : result.text;
  return {
    artifact,
    assistantText,
    tokens: result.tokens,
    model: result.model,
    provider: result.provider,
    demo: false,
  };
}

export function jobKindFor(role: AgentRole, action: GenerateAction = "default"): LlmJobKind {
  if (action === "build_website" || action === "build_deck") return "website";
  if (action === "build_app") return "apps";
  if (action === "research_pack" || action === "competitor_scan") return "research";
  if (action === "whatsapp_drafts") return "whatsapp";
  if (action === "inbox_replies") return "summaries";
  if (
    action === "generate_week" ||
    action === "sales_pack" ||
    action === "outreach_from_research" ||
    action === "ad_angles_from_url"
  ) {
    return "outreach";
  }
  if (role === "builder") return "website";
  if (role === "researcher") return "research";
  if (role === "writer" || role === "sales" || role === "ads") return "outreach";
  if (role === "ops") return "summaries";
  return "general";
}
