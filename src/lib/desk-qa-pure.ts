/**
 * Desk Q&A vs job playbook classifier. No database, no LLM.
 */

import {
  GENERATE_ACTIONS,
  JOB_ACTION_MESSAGES,
  type GenerateAction,
} from "@/lib/constants";

const JOB_ACTIONS = new Set<string>(GENERATE_ACTIONS);

const JOB_IMPERATIVE =
  /\b(linkedin week|sales pack|research pack|competitor (scan|watch)|prospecting scan|outreach (draft|pack)|ad angles|brand kit draft|inbox repl|whatsapp draft|multi-tab|follow-up sequence|talent sourc|give this agent a job|browse (the )?(site|url|page|company|website)|scan (this|the) (page|site|url|company))\b/i;

const JOB_COMMAND_START =
  /^(write|draft|generate|build|browse|scan|create|run|make|plan|research|compile|produce)\b/i;

const QUESTION_PREFIX =
  /^(what|what's|whats|who|who's|why|how|when|where|which|is |are |can |do |does |did |should |kya|kia|kyun|kaise|batao|bataen|samjhao|explain|tell me)\b/i;

export type DeskQaDecision = {
  qa: boolean;
  reason: string;
};

export function isLightweightDeskQuestion(input: {
  message: string;
  action?: string | null;
  playbookKey?: string | null;
  skillId?: string | null;
}): boolean {
  return decideDeskQa(input).qa;
}

export function decideDeskQa(input: {
  message: string;
  action?: string | null;
  playbookKey?: string | null;
  skillId?: string | null;
}): DeskQaDecision {
  if (input.skillId?.trim()) {
    return { qa: false, reason: "skill" };
  }
  if (input.playbookKey?.trim()) {
    return { qa: false, reason: "playbook" };
  }
  const action = (input.action || "default").trim();
  if (action && action !== "default" && JOB_ACTIONS.has(action as GenerateAction)) {
    return { qa: false, reason: "action" };
  }

  const message = input.message.trim();
  if (!message) return { qa: false, reason: "empty" };

  for (const canned of Object.values(JOB_ACTION_MESSAGES)) {
    if (canned && message === canned) {
      return { qa: false, reason: "chip" };
    }
  }

  const asks = /[?؟]\s*$/.test(message) || QUESTION_PREFIX.test(message);
  if (asks) {
    if (JOB_COMMAND_START.test(message)) {
      return { qa: false, reason: "question-command" };
    }
    return { qa: true, reason: "question" };
  }

  if (JOB_IMPERATIVE.test(message) || JOB_COMMAND_START.test(message)) {
    return { qa: false, reason: "imperative" };
  }

  if (message.length <= 280) {
    return { qa: true, reason: "chat" };
  }

  return { qa: false, reason: "brief" };
}
