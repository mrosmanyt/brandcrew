/**
 * Lightweight desk Q&A — one cheap LLM reply in the chat thread.
 * Playbook chips, generate actions, and explicit job verbs still go through
 * createJobFromChat. Questions like “what is our ICP?” do not.
 */

import { brandKitBrief, parseBrandKit } from "@/lib/brand-kit";
import { conversationKeyForAgent, displayAgentName } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { llm, runWithLlmRouting } from "@/lib/llm";
import { memoryBriefForWorkspace } from "@/lib/learning-memory";
import { serializeMessage } from "@/lib/job-serialize";
import type { MessageDTO } from "@/lib/types";
import { assertLlmCallBudget, recordUsage, rethrowIfBudget } from "@/lib/usage";
import { deskQaSystemPrompt } from "@/lib/desk-qa-pure";

export {
  decideDeskQa,
  deskQaSystemPrompt,
  isLightweightDeskQuestion,
  type DeskQaDecision,
} from "@/lib/desk-qa-pure";

function offlineAnswer(kitBrief: string, question: string) {
  return [
    "I can answer from the Brand Kit without starting a job.",
    "",
    kitBrief,
    "",
    `(No live model key on the server — this is Brand Kit context, not a generated playbook. You asked: “${question.slice(0, 180)}”)`,
  ].join("\n");
}

export type DeskQaResult = {
  qa: true;
  job: null;
  messages: MessageDTO[];
  artifact: null;
  demo: boolean;
};

export async function answerDeskQuestion(input: {
  workspaceId: string;
  agentId: string;
  message: string;
}): Promise<DeskQaResult> {
  await assertLlmCallBudget(input.workspaceId);

  const workspace = await prisma.workspace.findUniqueOrThrow({
    where: { id: input.workspaceId },
  });
  const agent = await prisma.agent.findFirst({
    where: {
      id: input.agentId,
      workspaceId: input.workspaceId,
      status: { not: "archived" },
    },
  });
  if (!agent) throw new Error("Choose an agent first.");

  const kit = parseBrandKit(workspace.brandKit);
  const kitBrief = brandKitBrief(kit);
  const memory = await memoryBriefForWorkspace(input.workspaceId);
  const agentName = displayAgentName(agent.name);
  const conversationKey = conversationKeyForAgent(agent.id);

  const conversation = await prisma.conversation.upsert({
    where: {
      workspaceId_agentRole: {
        workspaceId: input.workspaceId,
        agentRole: conversationKey,
      },
    },
    create: {
      workspaceId: input.workspaceId,
      agentId: agent.id,
      agentRole: conversationKey,
    },
    update: { agentId: agent.id },
  });

  const prior = await prisma.message.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: "desc" },
    take: 6,
  });

  const history = [...prior].reverse().map((row) => ({
    role: row.role as "user" | "assistant" | "system",
    content: row.content,
  }));

  const prefer =
    "modelRouting" in workspace
      ? String((workspace as { modelRouting?: string | null }).modelRouting ?? "")
      : "";

  let text = "";
  let tokens = 0;
  let model = "demo";
  let demo = true;

  if (llm.status().configured) {
    try {
      const result = await runWithLlmRouting(
        {
          prefer,
          plan: workspace.plan,
          workspaceId: input.workspaceId,
        },
        () =>
          llm.complete({
            mode: "draft",
            kind: "general",
            messages: [
              {
                role: "system",
                content: deskQaSystemPrompt({
                  agentName,
                  role: agent.role,
                  kitBrief,
                  memory,
                }),
              },
              ...history.filter((row) => row.role === "user" || row.role === "assistant"),
              { role: "user", content: input.message },
            ],
          }),
      );
      text = result.text.trim();
      tokens = result.tokens;
      model = result.model;
      demo = result.demo;
    } catch (error) {
      rethrowIfBudget(error);
      text = "";
    }
  }

  if (!text) {
    text = offlineAnswer(kitBrief, input.message);
    demo = true;
    model = "demo";
    tokens = 0;
  }

  if (tokens > 0) {
    await recordUsage({
      workspaceId: input.workspaceId,
      tokens,
      model,
      agentRole: agent.role || "writer",
      agentId: agent.id,
    });
  }

  const userMessage = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      role: "user",
      content: input.message,
    },
  });
  const assistantMessage = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      role: "assistant",
      content: text,
    },
  });

  return {
    qa: true,
    job: null,
    messages: [serializeMessage(userMessage), serializeMessage(assistantMessage)],
    artifact: null,
    demo,
  };
}
