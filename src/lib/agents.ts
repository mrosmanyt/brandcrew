import type { AgentRole, GenerateAction } from "@/lib/constants";
import { displayAgentName } from "@/lib/constants";
import { brandKitBrief, type BrandKit } from "@/lib/brand-kit";
import { demoArtifact, demoGenerateWeek, demoResearchPack, demoSalesPack } from "@/lib/demo";
import { llm, type TaskMode } from "@/lib/llm";
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
  ads: `Return ad angles with primary text. State that Brandcrew does not buy media.`,
  ops: `Return a short ops plan and a tasks array of items with status approve|schedule|done.`,
};

export function agentMode(role: AgentRole, action: GenerateAction = "default"): TaskMode {
  if (action === "generate_week" || action === "sales_pack" || action === "research_pack") {
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
    return `Write sourced notes from the Brand Kit and any fetched page text. Do not invent quotes.`;
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
  return `You are ${displayAgentName(agentName)} on Brandcrew, an AI desk.
${agentInstructions || `Role label: ${role}.`}
You share one Brand Kit. Produce ONE artifact. Never send, publish, or spend.

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

function parseLiveArtifact(
  text: string,
  role: AgentRole,
): GeneratedArtifact {
  const type =
    role === "researcher"
      ? "research_pack"
      : role === "sales"
        ? "sales_pack"
        : role === "ads"
          ? "ad_angles"
          : role === "ops"
            ? "ops_board"
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
  const name = displayAgentName(input.agentName);

  if (!status.configured) {
    const artifact = fallbackArtifact(input.role, input.kit, action);
    const assistantText = `${artifact.summary}\n\n(Offline demo draft — add OPENAI_API_KEY, ANTHROPIC_API_KEY, or GEMINI_API_KEY on the server. This template is not live work.)`;
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
      { role: "user", content: input.userMessage },
    ],
  });
  const artifact = parseLiveArtifact(result.text, input.role);
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
