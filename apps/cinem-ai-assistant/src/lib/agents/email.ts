/**
 * OSCAR — Email Agent (Gmail, Phase 4 implementation).
 *
 * Capabilities:
 *  • Inbox briefing — "check my email", "any new emails?" → unread summary
 *  • SAFE composing — "email ali@x.com about the invoice" → creates a Gmail
 *    DRAFT for review. Cinem AI Assistant never auto-sends mail.
 */
import type { AgentImpl, AgentRunContext } from "@/lib/agents/types";
import { gmailConnected, listUnread, createDraft, type MailItem } from "@/lib/gmail";
import { chatLLM } from "@/lib/llm";
import { languageDirective } from "@/lib/language";
import { useAppStore } from "@/store/useAppStore";

const NOT_CONNECTED =
  "Gmail isn't connected yet, Sir. Open Settings → API → Connect Gmail, approve in the browser, and I'll handle your inbox from then on.";

function wantsCompose(request: string): boolean {
  return /\b(send|compose|write|draft|reply)\b[\s\S]*\b(email|mail)\b|\b(email|mail)\b[\s\S]*\b(send|compose|write|draft|bhejo|likho)\b/i.test(
    request,
  );
}

async function inboxBriefing(ctx: AgentRunContext): Promise<string> {
  ctx.step("Fetching unread messages…");
  const mail = await listUnread(8);
  if (!mail.length) return "Inbox clear, Sir — no unread messages in your primary inbox.";

  ctx.step(`✓ ${mail.length} unread — summarizing…`);
  const lines = mail
    .map((m: MailItem, i) => `${i + 1}. FROM: ${m.from} | SUBJECT: ${m.subject} | ${m.snippet}`)
    .join("\n");
  const lang = languageDirective(useAppStore.getState().language);
  return (
    await chatLLM(
      `Summarize these unread emails as a crisp spoken briefing (group by importance, name senders, under 120 words). End with which ones need a reply.${lang}

${lines}`,
      ctx.settings,
      { system: "You are OSCAR, Cinem AI Assistant's Email Agent — crisp, efficient, loyal.", temperature: 0.4, maxTokens: 500 },
    )
  ).trim();
}

async function composeDraft(ctx: AgentRunContext): Promise<string> {
  ctx.step("Composing draft…");
  const raw = await chatLLM(
    `Extract and compose an email from this request: """${ctx.request}"""

Respond with ONLY this JSON:
{"to":"<recipient email, or empty if none given>","subject":"<subject>","body":"<professional email body, sign off as the user>"}`,
    ctx.settings,
    { json: true, temperature: 0.4, maxTokens: 700 },
  );
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("could not compose the email");
  const draft = JSON.parse(m[0]) as { to: string; subject: string; body: string };
  if (!draft.to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.to)) {
    return "I drafted the message, Sir, but I need the recipient's email address — tell me who it goes to and I'll place it in your drafts.";
  }
  await createDraft(draft.to, draft.subject, draft.body);
  ctx.step(`✓ Draft saved: "${draft.subject}" → ${draft.to}`);
  return `Done, Sir — I've placed a draft "${draft.subject}" to ${draft.to} in your Gmail drafts. Review it and hit send when ready (I never send without your eyes on it).`;
}

export const emailAgent: AgentImpl = {
  id: "email",
  systemPrompt: "You are OSCAR, Cinem AI Assistant's Email Agent — crisp, efficient, loyal.",
  tools: [],
  run: async (ctx) => {
    if (!gmailConnected(ctx.settings)) {
      ctx.step("Gmail not connected");
      return { findings: NOT_CONNECTED };
    }
    try {
      const findings = wantsCompose(ctx.request)
        ? await composeDraft(ctx)
        : await inboxBriefing(ctx);
      return { findings };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      ctx.step(`✗ ${msg}`);
      return { findings: `I hit a snag with Gmail, Sir: ${msg}` };
    }
  },
};
