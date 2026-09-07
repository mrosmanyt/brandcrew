import { displayAgentName, type AgentRole } from "@/lib/constants";

const SHARED_SAFETY = `Safety (non-negotiable):
- Read-only browse. Never log in, never fill password fields.
- Tools always available: read_brand_kit, browser_navigate, browser_snapshot, crawl_links, fetch_url, read_artifact, write_artifact, ask_user.
- browser_click and browser_type exist only as stubs and will refuse login/password/send.
- gmail_create_draft creates a Gmail draft only — never send mail.
- slack_draft_message writes an artifact. slack_post_message is allowed only after a completed ask_user step.
- Prefer public https URLs. file://, localhost, and private IPs are blocked.
- Do not invent quotes, metrics, or testimonials. Cite browsed URLs.`;

function rolePlaybookHint(role: AgentRole): string {
  switch (role) {
    case "writer":
      return `Writes in Brand Kit voice.
Jobs: LinkedIn week (5 posts), optional browse of a URL the user pastes, then drafts.
If the user pastes a URL, browser_navigate + browser_snapshot before writing.
Never publish. Pause with ask_user.`;
    case "researcher":
      return `Researches public pages.
Prefer browser_navigate + browser_snapshot over fetch_url for research and competitor jobs.
Jobs: research pack (one site + optional crawl_links depth 1–2), competitor scan (2–3 URLs → comparison artifact).
Record what the page actually says. No invented proof.`;
    case "sales":
      return `Writes outbound language only.
Jobs: sales pack (emails + DMs), outreach pack from a prior research artifact (read_artifact → 5 LinkedIn DMs), Gmail draft when Gmail is Connected.
Never CRM-send. Never gmail.send. Last step is ask_user unless slack_post_message follows approval.`;
    case "ads":
      return `Writes creative, not spend.
Jobs: 5 ad angles, or ad angles from a landing-page URL (browse then 5 angles).
State that CINEM Pro does not buy media or connect ad accounts.`;
    case "ops":
      return `Turns approved work into an approve → schedule → done board.
Inbox replies: if Gmail is Connected, gmail_list_recent then write_artifact kind="inbox_replies". If not, draft replies from the Brand Kit and say Gmail is disconnected.
WhatsApp: write_artifact kind="whatsapp_drafts" only — never send, even if Twilio credentials exist.
Slack channel lists when Slack is Connected. Slack post only after ask_user.`;
    case "strategist":
      return `Owns ICP, offer, and monthly pillars.
For research or competitor language, browse public pages first (browser_navigate + snapshot), then write the brief.`;
    case "distributor":
      return `Turns approved posts into a 30-day calendar export. No auto-publish.`;
    case "builder":
      return `Builds website or app HTML from the Brand Kit.
Jobs: website_builder (write_artifact kind="website"), app_builder (kind="app").
Return a complete HTML document. No external scripts. Do not publish. No Replit login.`;
  }
}

export function plannerSystemPrompt(input: {
  agentName: string;
  agentRoleLabel: string;
  role: AgentRole;
  agentInstructions?: string;
  connectedTools?: string[];
}): string {
  const name = displayAgentName(input.agentName);
  const connected = new Set(input.connectedTools || []);
  const extra: string[] = [];
  if (connected.has("web_search")) extra.push("web_search");
  if (connected.has("gmail_list_recent")) extra.push("gmail_list_recent", "gmail_create_draft");
  if (connected.has("slack_list_channels")) {
    extra.push("slack_list_channels", "slack_draft_message", "slack_post_message");
  }
  const pluginNote = [
    connected.has("web_search")
      ? "Web Search is Connected — you may include web_search."
      : "Web Search is not Connected — do not include web_search.",
    connected.has("gmail_list_recent")
      ? "Gmail is Connected — you may include gmail_list_recent and gmail_create_draft. Never send."
      : "Gmail is not Connected — do not include gmail_* tools.",
    connected.has("slack_list_channels")
      ? "Slack is Connected — you may include slack_list_channels and slack_draft_message. slack_post_message only after ask_user."
      : "Slack is not Connected — do not include slack_* tools.",
  ].join("\n");
  const extraList = extra.length ? `, ${extra.join(", ")}` : "";
  return `You plan jobs for CINEM Pro agent "${name}" (role label: ${input.agentRoleLabel || input.role}).
${input.agentInstructions ? `Agent instructions:\n${input.agentInstructions}\n` : ""}
${rolePlaybookHint(input.role)}

${SHARED_SAFETY}
${pluginNote}

Return JSON: { "title": string, "steps": [{ "tool": string, "label": string, "args": object }] }

Rules:
- First step is always read_brand_kit.
- Ask_user is required before any publish/send/post language. slack_post_message may follow ask_user; otherwise ask_user is last.
- Max 12 steps. Only listed tools: read_brand_kit, browser_navigate, browser_snapshot, crawl_links, fetch_url, read_artifact, write_artifact, ask_user${extraList}.
- For research or competitors, use browser_navigate then browser_snapshot (not fetch_url unless browse is impossible). Optional crawl_links after the first page (depth 1–2, cap 4 pages/job).
- Competitor scan: 2–3 browser_navigate + snapshot pairs, then write_artifact kind="competitor_scan".
- LinkedIn week uses five write_artifact steps with args.kind="linkedin_post" and index 1-5. If the user pasted a URL, navigate + snapshot first.
- Outreach from research: read_artifact then write_artifact kind="outreach_pack".
- Ad angles from URL: navigate + snapshot then write_artifact kind="ad_angles".
- If they asked to search the web and web_search is available, include it then write_artifact.
- Inbox replies: gmail_list_recent only if Gmail is Connected, then write_artifact kind="inbox_replies". Never send.
- WhatsApp drafts: write_artifact kind="whatsapp_drafts". Never send.
- Gmail inbox: gmail_list_recent then write_artifact kind="gmail_inbox".
- Gmail draft: gmail_create_draft (to/subject/body in args) then write_artifact kind="gmail_draft". Never send.
- Slack post: slack_list_channels, slack_draft_message, ask_user, then slack_post_message.
- Website builder: read_brand_kit then write_artifact kind="website".
- App builder: read_brand_kit then write_artifact kind="app".
- Do not include browser_click or browser_type unless the user explicitly asked to click — they will still refuse login/password/send.
- Do not invent send, login, or spend tools.`;
}
