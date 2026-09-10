import {
  AGENT_ROLES,
  playbookHintFromRole,
  type AgentRole,
  type GenerateAction,
} from "@/lib/constants";
import { extractUrls } from "@/lib/fetch-url";
import { JOB_TOOLS, type JobPlaybook, type JobStep, type JobTool } from "@/lib/job-types";
import { researchUrlsFromMessage } from "@/lib/multi-tab";
import { planHasAlwaysGatedTool } from "@/lib/write-gate";

function stepId(tool: string, hint: string) {
  return `${tool}-${hint}`.replace(/[^a-z0-9-]+/gi, "-").toLowerCase();
}

export function makeStep(
  tool: JobTool,
  label: string,
  args: Record<string, unknown> = {},
  hint?: string,
): JobStep {
  return {
    id: stepId(tool, hint || label),
    tool,
    label,
    status: "pending",
    args,
  };
}

export function resetPlaybook(playbook: JobPlaybook): JobPlaybook {
  return {
    ...playbook,
    steps: playbook.steps.map((step, index) => ({
      ...step,
      id: stepId(step.tool, `${index}-${step.label}`),
      status: "pending",
      result: undefined,
      args: { ...step.args },
    })),
  };
}

function approveStep(prompt: string): JobStep {
  return makeStep("ask_user", "Pause for your approval", { prompt, kind: "approve" }, "approve");
}

function clarifyStep(prompt: string, choices: string[] = ["Yes", "No"]): JobStep {
  return makeStep(
    "ask_user",
    "Needs a Yes/No before continuing",
    { prompt, kind: "clarify", choices },
    "clarify",
  );
}

export function linkedinWeekPlaybook(url?: string): JobPlaybook {
  const browse = url
    ? [
        makeStep("browser_navigate", `Open ${url}`, { url }, "nav"),
        makeStep("browser_snapshot", "Snapshot the page", {}, "snap"),
      ]
    : [];
  return {
    key: "linkedin_week",
    title: url ? "LinkedIn week from URL" : "LinkedIn week",
    agentRole: "writer",
    steps: [
      makeStep("read_brand_kit", "Read the Brand Kit", {}, "kit"),
      ...browse,
      ...[1, 2, 3, 4, 5].map((index) =>
        makeStep(
          "write_artifact",
          `Write LinkedIn post ${index}`,
          { kind: "linkedin_post", index, count: 5 },
          `post-${index}`,
        ),
      )
    ],
  };
}

export function writerFromUrlPlaybook(url?: string): JobPlaybook {
  return {
    key: "writer_from_url",
    title: "Draft from URL",
    agentRole: "writer",
    steps: [
      makeStep("read_brand_kit", "Read the Brand Kit", {}, "kit"),
      makeStep(
        "browser_navigate",
        url ? `Open ${url}` : "Open the pasted URL",
        { url: url || "" },
        "nav",
      ),
      makeStep("browser_snapshot", "Snapshot the page", {}, "snap"),
      makeStep(
        "write_artifact",
        "Write a draft from the page",
        { kind: "linkedin_post", index: 1, count: 1 },
        "draft",
      )
    ],
  };
}

export function researchPackPlaybook(url?: string): JobPlaybook {
  return {
    key: "research_pack",
    title: "Research notes",
    agentRole: "researcher",
    steps: [
      makeStep("read_brand_kit", "Read the Brand Kit", {}, "kit"),
      makeStep(
        "browser_navigate",
        url ? `Open ${url}` : "Open company website",
        { url: url || "" },
        "nav",
      ),
      makeStep(
        "crawl_links",
        "Follow a couple of public links",
        { depth: 1, maxPages: 2 },
        "crawl",
      ),
      makeStep("browser_snapshot", "Snapshot what we read", {}, "snap"),
      makeStep(
        "write_artifact",
        "Write sourced notes",
        { kind: "research_pack" },
        "summary",
      )
    ],
  };
}

export function competitorScanPlaybook(urls: string[] = []): JobPlaybook {
  const targets = urls.slice(0, 3);
  const browse = (targets.length ? targets : [""]).flatMap((url, index) => [
    makeStep(
      "browser_navigate",
      url ? `Open competitor ${index + 1}: ${url}` : "Open competitor URL",
      { url },
      `nav-${index + 1}`,
    ),
    makeStep(
      "browser_snapshot",
      url ? `Snapshot ${url}` : "Snapshot the page",
      {},
      `snap-${index + 1}`,
    ),
  ]);
  return {
    key: "competitor_scan",
    title: "Competitor scan",
    agentRole: "researcher",
    steps: [
      makeStep("read_brand_kit", "Read the Brand Kit", {}, "kit"),
      ...browse,
      makeStep(
        "write_artifact",
        "Write comparison artifact",
        { kind: "competitor_scan" },
        "compare",
      )
    ],
  };
}

export function salesPackPlaybook(): JobPlaybook {
  return {
    key: "sales_pack",
    title: "Outbound drafts",
    agentRole: "sales",
    steps: [
      makeStep("read_brand_kit", "Read the Brand Kit", {}, "kit"),
      makeStep(
        "write_artifact",
        "Write outbound email + LinkedIn DMs",
        { kind: "sales_pack" },
        "pack",
      )
    ],
  };
}

export function linkedinOutreachDraftPlaybook(url?: string): JobPlaybook {
  return {
    key: "linkedin_outreach_draft",
    title: "LinkedIn-style outreach draft",
    agentRole: "sales",
    steps: [
      makeStep("read_brand_kit", "Read the Brand Kit", {}, "kit"),
      clarifyStep(
        "Browse this public page and draft LinkedIn-style outreach? CINEM Pro will not send. Yes to continue, No to stop.",
      ),
      makeStep(
        "browser_navigate",
        url ? `Open ${url}` : "Open the public page",
        { url: url || "" },
        "nav",
      ),
      makeStep(
        "browser_extract",
        "Extract visible page text",
        { selector: "body" },
        "extract",
      ),
      makeStep(
        "write_artifact",
        "Draft LinkedIn-style outreach (do not send)",
        { kind: "outreach_pack" },
        "dms",
      )
    ],
  };
}

export function recruiterSheetPlaybook(url?: string): JobPlaybook {
  return {
    key: "recruiter_sheet",
    title: "Recruiter sheet from public page",
    agentRole: "sales",
    steps: [
      makeStep("read_brand_kit", "Read the Brand Kit", {}, "kit"),
      clarifyStep(
        "Extract public roles from this page into a markdown sheet? CINEM Pro will not email anyone. Yes to continue, No to stop.",
      ),
      makeStep(
        "browser_navigate",
        url ? `Open ${url}` : "Open the public careers or about page",
        { url: url || "" },
        "nav",
      ),
      makeStep(
        "browser_extract",
        "Extract roles and page text",
        { selector: "body" },
        "extract",
      ),
      makeStep(
        "write_artifact",
        "Fill a markdown sheet from the page",
        { kind: "recruiter_sheet" },
        "sheet",
      )
    ],
  };
}

export function inboxInvoicesPlaybook(gmailConnected = false): JobPlaybook {
  const inbox = gmailConnected
    ? [
        makeStep(
          "gmail_list_recent",
          "List Gmail invoices / receipts / bills",
          {
            max: 12,
            query: "in:inbox (invoice OR receipt OR bill OR invoiced) newer_than:90d",
          },
          "gmail-invoices",
        ),
      ]
    : [];
  return {
    key: "inbox_invoices",
    title: "Inbox invoice finder",
    agentRole: "ops",
    steps: [
      makeStep("read_brand_kit", "Read the Brand Kit", {}, "kit"),
      ...inbox,
      makeStep(
        "write_artifact",
        "List invoices from Gmail",
        { kind: "inbox_invoices" },
        "invoices",
      )
    ],
  };
}

export function outreachFromResearchPlaybook(): JobPlaybook {
  return {
    key: "outreach_from_research",
    title: "Outreach pack from research",
    agentRole: "sales",
    steps: [
      makeStep("read_brand_kit", "Read the Brand Kit", {}, "kit"),
      makeStep(
        "read_artifact",
        "Read the latest research artifact",
        { types: ["research_pack", "competitor_scan"] },
        "research",
      ),
      makeStep(
        "write_artifact",
        "Write 5 LinkedIn DMs from the research",
        { kind: "outreach_pack" },
        "dms",
      )
    ],
  };
}

export function adAnglesFromUrlPlaybook(url?: string): JobPlaybook {
  return {
    key: "ad_angles_from_url",
    title: "Ad angles from URL",
    agentRole: "ads",
    steps: [
      makeStep("read_brand_kit", "Read the Brand Kit", {}, "kit"),
      makeStep(
        "browser_navigate",
        url ? `Open ${url}` : "Open the landing page",
        { url: url || "" },
        "nav",
      ),
      makeStep("browser_snapshot", "Snapshot the landing page", {}, "snap"),
      makeStep(
        "write_artifact",
        "Write 5 ad angles from the page",
        { kind: "ad_angles" },
        "angles",
      )
    ],
  };
}

export function strategyFromSitePlaybook(url?: string): JobPlaybook {
  return {
    key: "strategy_from_site",
    title: "Strategy brief from site",
    agentRole: "strategist",
    steps: [
      makeStep("read_brand_kit", "Read the Brand Kit", {}, "kit"),
      makeStep(
        "browser_navigate",
        url ? `Open ${url}` : "Open company website",
        { url: url || "" },
        "nav",
      ),
      makeStep("browser_snapshot", "Snapshot the page", {}, "snap"),
      makeStep(
        "write_artifact",
        "Write ICP / offer / pillars brief",
        { kind: "generic" },
        "brief",
      )
    ],
  };
}

export function websiteBuilderPlaybook(): JobPlaybook {
  return {
    key: "website_builder",
    title: "Website builder",
    agentRole: "builder",
    steps: [
      makeStep("read_brand_kit", "Read the Brand Kit", {}, "kit"),
      makeStep(
        "write_artifact",
        "Write the website HTML",
        { kind: "website" },
        "site",
      )
    ],
  };
}

export function appBuilderPlaybook(): JobPlaybook {
  return {
    key: "app_builder",
    title: "App builder",
    agentRole: "builder",
    steps: [
      makeStep("read_brand_kit", "Read the Brand Kit", {}, "kit"),
      makeStep(
        "write_artifact",
        "Write the app HTML",
        { kind: "app" },
        "app",
      )
    ],
  };
}

export function deckBuilderPlaybook(): JobPlaybook {
  return {
    key: "deck_builder",
    title: "Pitch deck",
    agentRole: "builder",
    steps: [
      makeStep("read_brand_kit", "Read the Brand Kit", {}, "kit"),
      makeStep(
        "write_artifact",
        "Write the deck HTML",
        { kind: "deck" },
        "deck",
      )
    ],
  };
}

export function brandKitDraftPlaybook(): JobPlaybook {
  return {
    key: "brand_kit_draft",
    title: "Brand Kit creative",
    agentRole: "strategist",
    steps: [
      makeStep("read_brand_kit", "Read the Brand Kit", {}, "kit"),
      makeStep(
        "write_artifact",
        "Write Brand Kit creative",
        { kind: "brand_kit_draft" },
        "draft",
      )
    ],
  };
}

export function genericPlaybook(role: AgentRole, title?: string, url?: string): JobPlaybook {
  const browse = url
    ? [
        makeStep("browser_navigate", `Open ${url}`, { url }, "nav"),
        makeStep("browser_snapshot", "Snapshot the page", {}, "snap"),
      ]
    : [];
  return {
    key: "generic",
    title: title || "Draft",
    agentRole: role,
    steps: [
      makeStep("read_brand_kit", "Read the Brand Kit", {}, "kit"),
      ...browse,
      makeStep("write_artifact", "Write the draft", { kind: "generic" }, "artifact")
    ],
  };
}

export function webSearchPlaybook(query?: string): JobPlaybook {
  return {
    key: "web_search",
    title: "Web search",
    agentRole: "researcher",
    steps: [
      makeStep("read_brand_kit", "Read the Brand Kit", {}, "kit"),
      makeStep(
        "web_search",
        query ? `Search: ${query}` : "Search the web",
        { query: query || "" },
        "search",
      ),
      makeStep(
        "write_artifact",
        "Write notes from search",
        { kind: "research_pack" },
        "summary",
      )
    ],
  };
}

export function inboxRepliesPlaybook(gmailConnected = false): JobPlaybook {
  const inbox = gmailConnected
    ? [makeStep("gmail_list_recent", "List recent Gmail", { max: 8 }, "gmail-list")]
    : [];
  return {
    key: "inbox_replies",
    title: "Inbox replies (approve before send)",
    agentRole: "ops",
    steps: [
      makeStep("read_brand_kit", "Read the Brand Kit", {}, "kit"),
      ...inbox,
      makeStep(
        "write_artifact",
        "Draft inbox replies",
        { kind: "inbox_replies" },
        "replies",
      )
    ],
  };
}

export function whatsappDraftsPlaybook(): JobPlaybook {
  return {
    key: "whatsapp_drafts",
    title: "WhatsApp drafts (do not send)",
    agentRole: "ops",
    steps: [
      makeStep("read_brand_kit", "Read the Brand Kit", {}, "kit"),
      makeStep(
        "write_artifact",
        "Draft WhatsApp replies",
        { kind: "whatsapp_drafts" },
        "wa",
      )
    ],
  };
}

export function gmailInboxPlaybook(): JobPlaybook {
  return {
    key: "gmail_inbox",
    title: "Gmail inbox",
    agentRole: "ops",
    steps: [
      makeStep("read_brand_kit", "Read the Brand Kit", {}, "kit"),
      makeStep("gmail_list_recent", "List recent Gmail", { max: 8 }, "gmail-list"),
      makeStep(
        "write_artifact",
        "Write inbox notes",
        { kind: "gmail_inbox" },
        "notes",
      )
    ],
  };
}

export function gmailDraftPlaybook(): JobPlaybook {
  return {
    key: "gmail_draft",
    title: "Gmail draft",
    agentRole: "sales",
    steps: [
      makeStep("read_brand_kit", "Read the Brand Kit", {}, "kit"),
      makeStep(
        "gmail_create_draft",
        "Create a Gmail draft (do not send)",
        { kind: "gmail_draft" },
        "gmail-draft",
      ),
      makeStep(
        "write_artifact",
        "Record the Gmail draft",
        { kind: "gmail_draft" },
        "record",
      )
    ],
  };
}

export function slackChannelsPlaybook(): JobPlaybook {
  return {
    key: "slack_channels",
    title: "Slack channels",
    agentRole: "ops",
    steps: [
      makeStep("read_brand_kit", "Read the Brand Kit", {}, "kit"),
      makeStep("slack_list_channels", "List Slack channels", {}, "slack-list"),
      makeStep(
        "write_artifact",
        "Write channel list",
        { kind: "slack_channels" },
        "notes",
      )
    ],
  };
}

export function slackPostPlaybook(): JobPlaybook {
  return {
    key: "slack_post",
    title: "Slack post (approval required)",
    agentRole: "ops",
    steps: [
      makeStep("read_brand_kit", "Read the Brand Kit", {}, "kit"),
      makeStep("slack_list_channels", "List Slack channels", {}, "slack-list"),
      makeStep(
        "slack_draft_message",
        "Draft a Slack message",
        { kind: "slack_draft" },
        "slack-draft",
      ),
      approveStep(
        "Approve this Slack draft. CINEM Pro will post only after you approve.",
      ),
      makeStep(
        "slack_post_message",
        "Post the approved Slack message",
        {},
        "slack-post",
      ),
    ],
  };
}

export function prospectingScanPlaybook(url?: string): JobPlaybook {
  return {
    key: "prospecting_scan",
    title: "Prospecting scan",
    agentRole: "sales",
    steps: [
      makeStep("read_brand_kit", "Read the Brand Kit", {}, "kit"),
      makeStep(
        "browser_navigate",
        url ? `Open ${url}` : "Open the public prospect page",
        { url: url || "" },
        "nav",
      ),
      makeStep("browser_snapshot", "Snapshot the public page", {}, "snap"),
      makeStep(
        "browser_extract",
        "Extract visible company/person text",
        { selector: "body" },
        "extract",
      ),
      makeStep(
        "write_artifact",
        "Write sourced prospecting notes",
        { kind: "prospecting_scan" },
        "notes",
      )
    ],
  };
}

export function outreachDraftPackPlaybook(url?: string): JobPlaybook {
  const browse = url
    ? [
        makeStep("browser_navigate", `Open ${url}`, { url }, "nav"),
        makeStep("browser_extract", "Extract visible page text", { selector: "body" }, "extract"),
      ]
    : [
        makeStep(
          "read_artifact",
          "Read the latest research or prospecting artifact",
          { types: ["research_pack", "competitor_scan", "prospecting_scan", "weekly_client_brief"] },
          "research",
        ),
      ];
  return {
    key: "outreach_draft_pack",
    title: "Outreach draft pack",
    agentRole: "sales",
    steps: [
      makeStep("read_brand_kit", "Read the Brand Kit", {}, "kit"),
      ...browse,
      makeStep(
        "write_artifact",
        "Write 5 outreach drafts (do not send)",
        { kind: "outreach_pack" },
        "pack",
      )
    ],
  };
}

export function weeklyClientBriefPlaybook(url?: string): JobPlaybook {
  return {
    key: "weekly_client_brief",
    title: "Weekly client brief",
    agentRole: "researcher",
    steps: [
      makeStep("read_brand_kit", "Read the Brand Kit", {}, "kit"),
      makeStep(
        "browser_navigate",
        url ? `Open ${url}` : "Open the client or Brand Kit site",
        { url: url || "" },
        "nav",
      ),
      makeStep("browser_snapshot", "Snapshot the public page", {}, "snap"),
      makeStep(
        "crawl_links",
        "Follow a couple of public links on the same site",
        { depth: 1, maxPages: 2 },
        "crawl",
      ),
      makeStep(
        "write_artifact",
        "Write a sourced weekly client brief",
        { kind: "weekly_client_brief" },
        "brief",
      )
    ],
  };
}

export function dailyClientBriefPlaybook(urls: string[] = []): JobPlaybook {
  const list = urls.slice(0, 10);
  return {
    key: "daily_client_brief",
    title: "Daily client brief",
    agentRole: "researcher",
    steps: [
      makeStep("read_brand_kit", "Read the Brand Kit and client memory", {}, "kit"),
      makeStep(
        "browser_tabs",
        list.length
          ? `Open ${list.length} public tab${list.length === 1 ? "" : "s"} in parallel`
          : "Open the Brand Kit / pasted URLs in parallel tabs",
        { urls: list, intent: 5 },
        "tabs",
      ),
      makeStep(
        "write_artifact",
        "Write a sourced daily client brief",
        { kind: "daily_client_brief" },
        "brief",
      ),
    ],
  };
}

export function seoBriefPlaybook(urls: string[] = []): JobPlaybook {
  const list = urls.slice(0, 10);
  return {
    key: "seo_brief",
    title: "SEO brief",
    agentRole: "researcher",
    steps: [
      makeStep("read_brand_kit", "Read the Brand Kit", {}, "kit"),
      makeStep(
        "browser_tabs",
        list.length ? `Open ${list.length} public SEO pages` : "Open the client site in parallel tabs",
        { urls: list, intent: 5 },
        "tabs",
      ),
      makeStep(
        "write_artifact",
        "Write a sourced SEO brief",
        { kind: "seo_brief" },
        "brief",
      ),
    ],
  };
}

export function multiTabResearchPlaybook(urls: string[] = []): JobPlaybook {
  const list = urls.slice(0, 10);
  return {
    key: "multi_tab_research",
    title: "Multi-tab research",
    agentRole: "researcher",
    steps: [
      makeStep("read_brand_kit", "Read the Brand Kit", {}, "kit"),
      makeStep(
        "browser_tabs",
        list.length
          ? `Research ${list.length} public URL${list.length === 1 ? "" : "s"} in parallel tabs`
          : "Open pasted public URLs in parallel tabs (paste 5–10)",
        { urls: list, intent: 5 },
        "tabs",
      ),
      makeStep(
        "write_artifact",
        "Write sourced multi-tab notes",
        { kind: "multi_tab_research" },
        "notes",
      ),
    ],
  };
}

export function clientNamedEmailPlaybook(): JobPlaybook {
  return {
    key: "client_named_email",
    title: "Client-named email draft",
    agentRole: "sales",
    steps: [
      makeStep("read_brand_kit", "Read the Brand Kit and client memory", {}, "kit"),
      makeStep(
        "read_artifact",
        "Read the latest research or brief",
        { types: ["research_pack", "prospecting_scan", "weekly_client_brief", "daily_client_brief", "seo_brief"] },
        "research",
      ),
      makeStep(
        "write_artifact",
        "Draft the client-named email (do not send)",
        { kind: "client_named_email" },
        "draft",
      ),
      approveStep(
        "Approve this client-named email. CINEM Pro will create a Gmail draft only after you say yes. It will not send.",
      ),
      makeStep(
        "gmail_create_draft",
        "Create a Gmail draft (do not send)",
        { kind: "gmail_draft", clientNamed: true },
        "gmail-draft",
      ),
    ],
  };
}

export function followUpSequencePlaybook(): JobPlaybook {
  return {
    key: "follow_up_sequence",
    title: "Follow-up sequence",
    agentRole: "sales",
    steps: [
      makeStep("read_brand_kit", "Read the Brand Kit", {}, "kit"),
      makeStep(
        "read_artifact",
        "Read the latest research or outreach pack",
        { types: ["research_pack", "prospecting_scan", "outreach_pack", "weekly_client_brief"] },
        "research",
      ),
      makeStep(
        "write_artifact",
        "Write a 5-touch follow-up sequence (do not send)",
        { kind: "follow_up_sequence" },
        "sequence",
      ),
    ],
  };
}

export function competitorWatchPlaybook(urls: string[] = []): JobPlaybook {
  const list = urls.slice(0, 10);
  return {
    key: "competitor_watch",
    title: "Competitor watch",
    agentRole: "researcher",
    steps: [
      makeStep("read_brand_kit", "Read the Brand Kit", {}, "kit"),
      makeStep(
        "browser_tabs",
        list.length ? `Watch ${list.length} public competitor page${list.length === 1 ? "" : "s"}` : "Open competitor URLs in parallel tabs",
        { urls: list, intent: 5 },
        "tabs",
      ),
      makeStep(
        "write_artifact",
        "Write a sourced competitor watch note",
        { kind: "competitor_watch" },
        "watch",
      ),
    ],
  };
}

export function talentSourcingPlaybook(url?: string): JobPlaybook {
  const sheet = recruiterSheetPlaybook(url);
  return { ...sheet, key: "talent_sourcing", title: "Talent sourcing" };
}

/** Public URLs from the user message, then Brand Kit website. Never invents example.com competitors. */
export function defaultCompetitorUrls(message: string, website?: string): string[] {
  const fromMessage = extractUrls(message).slice(0, 3);
  const urls: string[] = [];
  const seen = new Set<string>();
  for (const url of [...fromMessage, website || ""]) {
    const trimmed = url.trim();
    if (!trimmed) continue;
    const key = trimmed.replace(/\/$/, "").toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    urls.push(trimmed);
    if (urls.length >= 3) break;
  }
  return urls;
}

export function playbookFromKey(
  key: string,
  role: AgentRole,
  message = "",
  website?: string,
  options?: { gmailConnected?: boolean },
): JobPlaybook {
  const url = extractUrls(message)[0] || website || "";
  if (key === "linkedin_week") return linkedinWeekPlaybook(extractUrls(message)[0]);
  if (key === "writer_from_url") return writerFromUrlPlaybook(url);
  if (key === "research_pack") return researchPackPlaybook(url);
  if (key === "competitor_scan") {
    return competitorScanPlaybook(defaultCompetitorUrls(message, website));
  }
  if (key === "sales_pack") return salesPackPlaybook();
  if (key === "outreach_from_research") return outreachFromResearchPlaybook();
  if (key === "linkedin_outreach_draft") return linkedinOutreachDraftPlaybook(url);
  if (key === "recruiter_sheet") return recruiterSheetPlaybook(url);
  if (key === "inbox_invoices") return inboxInvoicesPlaybook(Boolean(options?.gmailConnected));
  if (key === "ad_angles_from_url") return adAnglesFromUrlPlaybook(url);
  if (key === "strategy_from_site") return strategyFromSitePlaybook(url);
  if (key === "web_search") return webSearchPlaybook(message.trim());
  if (key === "inbox_replies") return inboxRepliesPlaybook(Boolean(options?.gmailConnected));
  if (key === "whatsapp_drafts") return whatsappDraftsPlaybook();
  if (key === "gmail_inbox") return gmailInboxPlaybook();
  if (key === "gmail_draft") return gmailDraftPlaybook();
  if (key === "slack_channels") return slackChannelsPlaybook();
  if (key === "slack_post") return slackPostPlaybook();
  if (key === "website_builder") return websiteBuilderPlaybook();
  if (key === "app_builder") return appBuilderPlaybook();
  if (key === "deck_builder") return deckBuilderPlaybook();
  if (key === "brand_kit_draft") return brandKitDraftPlaybook();
  if (key === "prospecting_scan") return prospectingScanPlaybook(url);
  if (key === "outreach_draft_pack") return outreachDraftPackPlaybook(extractUrls(message)[0] || url || "");
  if (key === "weekly_client_brief") return weeklyClientBriefPlaybook(url);
  if (key === "daily_client_brief") {
    return dailyClientBriefPlaybook(researchUrlsFromMessage(message, website));
  }
  if (key === "seo_brief") return seoBriefPlaybook(researchUrlsFromMessage(message, website));
  if (key === "multi_tab_research") {
    return multiTabResearchPlaybook(researchUrlsFromMessage(message, website));
  }
  if (key === "client_named_email") return clientNamedEmailPlaybook();
  if (key === "follow_up_sequence") return followUpSequencePlaybook();
  if (key === "competitor_watch") {
    return competitorWatchPlaybook(researchUrlsFromMessage(message, website));
  }
  if (key === "talent_sourcing") return talentSourcingPlaybook(url);
  return genericPlaybook(role, undefined, url);
}

export function inferPlaybookKey(
  role: AgentRole | string,
  message: string,
  action?: GenerateAction,
): string {
  if (action === "generate_week") return "linkedin_week";
  if (action === "sales_pack") return "sales_pack";
  if (action === "research_pack") return "research_pack";
  if (action === "competitor_scan") return "competitor_scan";
  if (action === "outreach_from_research") return "outreach_from_research";
  if (action === "linkedin_outreach_draft") return "linkedin_outreach_draft";
  if (action === "inbox_invoices") return "inbox_invoices";
  if (action === "prospecting_scan") return "prospecting_scan";
  if (action === "outreach_draft_pack") return "outreach_draft_pack";
  if (action === "weekly_client_brief") return "weekly_client_brief";
  if (action === "daily_client_brief") return "daily_client_brief";
  if (action === "seo_brief") return "seo_brief";
  if (action === "client_named_email") return "client_named_email";
  if (action === "multi_tab_research") return "multi_tab_research";
  if (action === "follow_up_sequence") return "follow_up_sequence";
  if (action === "competitor_watch") return "competitor_watch";
  if (action === "talent_sourcing") return "talent_sourcing";
  if (action === "ad_angles_from_url") return "ad_angles_from_url";
  if (action === "build_website") return "website_builder";
  if (action === "build_app") return "app_builder";
  if (action === "build_deck") return "deck_builder";
  if (action === "brand_kit_draft") return "brand_kit_draft";
  if (action === "inbox_replies") return "inbox_replies";
  if (action === "whatsapp_drafts") return "whatsapp_drafts";
  const text = message.toLowerCase();
  const urls = extractUrls(message);
  const hint = AGENT_ROLES.includes(role as AgentRole)
    ? (role as AgentRole)
    : playbookHintFromRole(String(role));
  if (/web search|search the web|tavily/.test(text)) {
    return "web_search";
  }
  if (/whatsapp/.test(text) && /draft|repl(y|ies)|inbox/.test(text)) {
    return "whatsapp_drafts";
  }
  if (
    /inbox repl(y|ies)|draft repl(y|ies)|approve[- ]before[- ]send/.test(text) ||
    ((hint === "ops" || /support|inbox/.test(text)) &&
      /repl(y|ies)/.test(text) &&
      !/whatsapp/.test(text))
  ) {
    return "inbox_replies";
  }
  if (/gmail draft|draft (an? )?email|create (a )?gmail draft/.test(text)) {
    return "gmail_draft";
  }
  if (/invoice|receipt|quickbooks|bill(s)? from (gmail|inbox)/.test(text)) {
    return "inbox_invoices";
  }
  if (/gmail|inbox|recent (email|mail)/.test(text)) {
    return /repl(y|ies)/.test(text) ? "inbox_replies" : "gmail_inbox";
  }
  if (/slack/.test(text) && /post|message|send/.test(text)) {
    return "slack_post";
  }
  if (/slack/.test(text)) {
    return "slack_channels";
  }
  if (/linkedin week|week of (linkedin )?posts|generate week/.test(text)) {
    return "linkedin_week";
  }
  if (
    /competitor scan|compare (competitors|sites|urls)|scan (of )?(competitors|sites)/.test(
      text,
    ) ||
    (hint === "researcher" && /competitor/.test(text))
  ) {
    return "competitor_scan";
  }
  if (
    /prospecting scan|prospect scan|who is this (company|page)|scan this (public )?page/.test(
      text,
    )
  ) {
    return "prospecting_scan";
  }
  if (/outreach draft pack|draft pack|5 outreach drafts/.test(text)) {
    return "outreach_draft_pack";
  }
  if (/daily client brief|daily brief/.test(text)) {
    return "daily_client_brief";
  }
  if (/weekly client brief|weekly brief/.test(text) || (/\bclient brief\b/.test(text) && !/daily/.test(text))) {
    return "weekly_client_brief";
  }
  if (/seo brief|seo notes|keyword brief/.test(text)) {
    return "seo_brief";
  }
  if (/multi-tab|parallel (tabs|research)|research (5|five|10|ten) (urls|pages|tabs)/.test(text)) {
    return "multi_tab_research";
  }
  if (/client-named email|client named email|email (the )?client/.test(text)) {
    return "client_named_email";
  }
  if (/follow-up sequence|follow up sequence|5-touch|five.touch/.test(text)) {
    return "follow_up_sequence";
  }
  if (/competitor watch|watch (these )?competitors/.test(text)) {
    return "competitor_watch";
  }
  if (/talent sourc|candidate sourc/.test(text)) {
    return "talent_sourcing";
  }
  if (
    /research pack|research (the )?(site|company|page)|browse (the )?(site|company)/.test(
      text,
    ) ||
    (hint === "researcher" && /site|url|company|fetch|browse/.test(text))
  ) {
    return "research_pack";
  }
  if (
    (hint === "sales" || /outreach/.test(text)) &&
    /outreach (pack )?from research|from (the )?research artifact|5 dms/.test(text)
  ) {
    return "outreach_from_research";
  }
  if (
    (hint === "sales" || /outreach|linkedin/.test(text)) &&
    /linkedin-style|outreach draft|draft outreach|prospect/.test(text)
  ) {
    return "linkedin_outreach_draft";
  }
  if (
    /recruiter|careers page|role sheet|candidate sheet/.test(text) ||
    (hint === "sales" && /recruit/.test(text))
  ) {
    return "recruiter_sheet";
  }
  if (hint === "sales" && /sales pack|outbound|linkedin dm|email script/.test(text)) {
    return "sales_pack";
  }
  if (
    /prospecting scan|prospect scan|who is this (company|page)|scan this (public )?page/.test(
      text,
    ) ||
    ((hint === "sales" || hint === "researcher") && /prospect/.test(text) && /scan|research|page/.test(text))
  ) {
    return "prospecting_scan";
  }
  if (
    /outreach draft pack|draft pack|5 outreach drafts/.test(text) ||
    (hint === "sales" && /draft pack/.test(text))
  ) {
    return "outreach_draft_pack";
  }
  if (
    /weekly client brief|client brief|weekly brief/.test(text) ||
    (hint === "researcher" && /weekly brief|client update/.test(text))
  ) {
    return "weekly_client_brief";
  }
  if (
    hint === "ads" &&
    /ad angles from (url|the page|landing)|landing page/.test(text)
  ) {
    return "ad_angles_from_url";
  }
  if (
    hint === "strategist" &&
    (urls.length > 0 || /browse|research|competitor|website/.test(text))
  ) {
    return "strategy_from_site";
  }
  if (hint === "writer" && urls.length > 0 && !/linkedin week/.test(text)) {
    return "writer_from_url";
  }
  if (hint === "writer" && /linkedin|posts?/.test(text)) return "linkedin_week";
  if (
    /build (an? |the )?(app|web app|mini app)|app builder/.test(text) &&
    !/website|landing page|web site/.test(text)
  ) {
    return "app_builder";
  }
  if (
    /pitch deck|slide deck|presentation deck|build (an? |the )?(deck|slides|presentation)/.test(
      text,
    )
  ) {
    return "deck_builder";
  }
  if (
    /brand kit (creative|draft)|creative draft|visual direction/.test(text)
  ) {
    return "brand_kit_draft";
  }
  if (
    /build (an? |the )?(website|landing|site)|website builder|one-page site/.test(
      text,
    )
  ) {
    return "website_builder";
  }
  if (hint === "builder") {
    if (/deck|slides|presentation/.test(text)) return "deck_builder";
    if (/^app$|app builder/.test(String(role).toLowerCase())) return "app_builder";
    return "website_builder";
  }
  return "generic";
}

export function isJobTool(value: string): value is JobTool {
  return (JOB_TOOLS as readonly string[]).includes(value);
}

export function parsePlan(raw: string | JobStep[]): JobStep[] {
  if (Array.isArray(raw)) return raw.map(normalizeStep);
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeStep).filter((step) => isJobTool(step.tool));
  } catch {
    return [];
  }
}

function normalizeStep(input: unknown, index: number): JobStep {
  const row = (input ?? {}) as Record<string, unknown>;
  const tool = isJobTool(String(row.tool)) ? (row.tool as JobTool) : "write_artifact";
  const args =
    row.args && typeof row.args === "object" && !Array.isArray(row.args)
      ? (row.args as Record<string, unknown>)
      : {};
  const status =
    row.status === "done" || row.status === "running" || row.status === "paused"
      ? row.status
      : "pending";
  return {
    id: String(row.id || stepId(tool, String(index))),
    tool,
    label: String(row.label || tool),
    status,
    args,
    result: row.result ? String(row.result) : undefined,
  };
}

export function ensureAskUser(steps: JobStep[]): JobStep[] {
  if (!steps.length) return steps;
  if (steps.at(-1)?.tool === "ask_user") return steps;
  if (!planHasAlwaysGatedTool(steps)) return steps;
  return [
    ...steps,
    makeStep(
      "ask_user",
      "Pause for your approval",
      {
        prompt:
          "Approve this send, post, or irreversible write. CINEM Pro will not run it until you say yes.",
        kind: "approve",
      },
      "approve",
    ),
  ];
}

export function parsePlaybookJson(raw: string): JobPlaybook | null {
  try {
    const parsed = JSON.parse(raw) as JobPlaybook;
    if (!parsed || !Array.isArray(parsed.steps)) return null;
    return resetPlaybook({
      key: String(parsed.key || "custom"),
      title: String(parsed.title || "Saved skill"),
      agentRole: AGENT_ROLES.includes(parsed.agentRole as AgentRole)
        ? (parsed.agentRole as AgentRole)
        : "writer",
      steps: parsePlan(parsed.steps),
    });
  } catch {
    return null;
  }
}
