import type { AgentRole, GenerateAction } from "@/lib/constants";
import { AGENT_META } from "@/lib/constants";
import { brandKitBrief, type BrandKit } from "@/lib/brand-kit";
import { demoArtifact, demoGenerateWeek, demoResearchPack, demoSalesPack } from "@/lib/demo";
import { llm, type TaskMode } from "@/lib/llm";
import type { GeneratedArtifact } from "@/lib/agents-types";

export type { GeneratedArtifact } from "@/lib/agents-types";

const ROLE_INSTRUCTIONS: Record<AgentRole, string> = {
  strategist: `Return one strategy brief. Sections: Ideal customer (ICP), Offer, three monthly content pillars, and What not to say. This is the shared brief — not a slide deck.`,
  writer: `Return one voice pack: two LinkedIn posts and one email newsletter draft. Match the Brand Kit voice. Do not use forbidden words.`,
  researcher: `Return one research pack: source URL, what the site actually says, messaging implications, and what not to copy. No invented quotes.`,
  distributor: `Return a 30-day content calendar starting tomorrow. Include a Markdown table and a "calendar" array of 30 objects: {date (YYYY-MM-DD), channel (linkedin|email), title, content}. Ready to paste into Google Docs.`,
  sales: `Return 8 outbound scripts mixing email and LinkedIn DMs. No CRM fields. Each script is short enough to send today.`,
  ads: `Return 5 ad angles with primary text. Explicitly state that Brandcrew does not buy media or connect ad accounts.`,
  ops: `Return a short ops plan and a "tasks" array of 5 items: {title, description, status} where status is approve|schedule|done.`,
};

export function agentMode(role: AgentRole, action: GenerateAction = "default"): TaskMode {
  if (action === "generate_week" || action === "sales_pack" || action === "research_pack") {
    return "draft";
  }
  return role === "strategist" || role === "ads" ? "final" : "draft";
}

function actionInstructions(action: GenerateAction, role: AgentRole) {
  if (action === "generate_week") {
    return `Write exactly 5 LinkedIn posts for the next week in Brand Kit voice. Return Markdown with ## 1. … through ## 5. Also return a "calendar" array of 5 objects: {date (YYYY-MM-DD starting tomorrow), channel: "linkedin", title, content}.`;
  }
  if (action === "sales_pack") {
    return `Write a sales pack: 5 outbound emails and 5 LinkedIn DMs. Markdown headings ## Email 1 … ## Email 5 and ## LinkedIn DM 1 … ## LinkedIn DM 5. No CRM fields.`;
  }
  if (action === "research_pack") {
    return `Write a research pack from the Brand Kit and any fetched page text in the user message. Sections: Source, What the site says, Messaging implications, What not to copy.`;
  }
  return ROLE_INSTRUCTIONS[role];
}

export function systemPrompt(
  role: AgentRole,
  kit: BrandKit,
  action: GenerateAction = "default",
) {
  const meta = AGENT_META[role];
  return `You are the ${meta.label} on Brandcrew, an AI Business Desk.
You share one Brand Kit and company memory with the other thin agents.
Produce ONE approved-quality artifact — not a feature dump.

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
}`;
}

function fallbackArtifact(
  role: AgentRole,
  kit: BrandKit,
  action: GenerateAction,
): GeneratedArtifact {
  if (action === "generate_week") return demoGenerateWeek(kit);
  if (action === "sales_pack") return demoSalesPack(kit);
  if (action === "research_pack") return demoResearchPack(kit);
  return demoArtifact(role, kit);
}

function parseArtifact(
  text: string,
  role: AgentRole,
  kit: BrandKit,
  action: GenerateAction,
): GeneratedArtifact {
  const fallback = fallbackArtifact(role, kit, action);
  try {
    const json = JSON.parse(text);
    return {
      type: fallback.type,
      title: String(json.title || fallback.title),
      summary: String(json.summary || fallback.summary),
      content: String(json.content || fallback.content),
      calendar: Array.isArray(json.calendar) ? json.calendar : fallback.calendar,
      tasks: Array.isArray(json.tasks) ? json.tasks : fallback.tasks,
    };
  } catch {
    if (text.trim()) {
      return {
        type: fallback.type,
        title: fallback.title,
        summary: fallback.summary,
        content: text,
        calendar: fallback.calendar,
        tasks: fallback.tasks,
      };
    }
    return fallback;
  }
}

export async function generateAgentArtifact(input: {
  role: AgentRole;
  kit: BrandKit;
  userMessage: string;
  history: { role: "user" | "assistant"; content: string }[];
  action?: GenerateAction;
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
  const status = llm.status();

  if (!status.configured) {
    const artifact = fallbackArtifact(input.role, input.kit, action);
    const assistantText = `${artifact.summary}\n\n(Offline demo draft — add OPENAI_API_KEY, ANTHROPIC_API_KEY, or GEMINI_API_KEY on the server to generate with a live model.)`;
    return {
      artifact,
      assistantText,
      tokens: 0,
      model: "demo",
      provider: "demo",
      demo: true,
    };
  }

  try {
    const result = await llm.complete({
      mode,
      json: true,
      messages: [
        { role: "system", content: systemPrompt(input.role, input.kit, action) },
        ...input.history.slice(-8).map((m) => ({
          role: m.role,
          content: m.content,
        })),
        { role: "user", content: input.userMessage },
      ],
    });
    const artifact = parseArtifact(result.text, input.role, input.kit, action);
    const assistantText = artifact.summary
      ? `${artifact.summary}\n\nI drafted **${artifact.title}**. Approve it when it is the one artifact you want to keep.`
      : result.text;
    return {
      artifact,
      assistantText,
      tokens: result.tokens,
      model: result.model,
      provider: result.provider,
      demo: false,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "LLM error";
    if (message === "NO_LLM_KEYS") {
      const artifact = fallbackArtifact(input.role, input.kit, action);
      return {
        artifact,
        assistantText: artifact.summary,
        tokens: 0,
        model: "demo",
        provider: "demo",
        demo: true,
      };
    }
    throw error;
  }
}
