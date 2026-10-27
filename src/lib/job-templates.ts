import type { GenerateAction } from "@/lib/constants";

export type JobTemplate = {
  id: string;
  title: string;
  blurb: string;
  playbookKey: string;
  action: GenerateAction;
  message: string;
  roleHint: string;
  featured: boolean;
};

/** Featured Marketplace playbooks — one-click jobs, not fake results. */
export const FEATURED_JOB_TEMPLATES: JobTemplate[] = [
  {
    id: "tpl-linkedin-week",
    title: "LinkedIn week",
    blurb: "Five posts in Brand Kit voice. Pauses for approval. Does not publish.",
    playbookKey: "linkedin_week",
    action: "generate_week",
    message:
      "Write a LinkedIn-week job: five posts in Brand Kit voice, then pause for my approval. Do not publish.",
    roleHint: "Content",
    featured: true,
  },
  {
    id: "tpl-competitor-scan",
    title: "Competitor scan",
    blurb: "Browse public URLs (or the Brand Kit site) and write a comparison. Read-only.",
    playbookKey: "competitor_scan",
    action: "competitor_scan",
    message:
      "Competitor scan: browse the public URLs in this message (or the Brand Kit website) and write a comparison artifact.",
    roleHint: "Research",
    featured: true,
  },
  {
    id: "tpl-website",
    title: "Website one-click",
    blurb: "One-page branded HTML from the Brand Kit. Preview in the desk. Not published.",
    playbookKey: "website_builder",
    action: "build_website",
    message: "Build a one-page branded website from the Brand Kit. Return a complete HTML document. Do not publish.",
    roleHint: "Website",
    featured: true,
  },
  {
    id: "tpl-outreach",
    title: "Outreach draft",
    blurb: "Five LinkedIn DMs from the latest research artifact. You send them.",
    playbookKey: "outreach_from_research",
    action: "outreach_from_research",
    message: "Write an outreach pack of 5 LinkedIn DMs from the latest research artifact. Do not send.",
    roleHint: "Sales",
    featured: true,
  },
  {
    id: "tpl-deck",
    title: "Pitch deck",
    blurb: "Short Brand Kit slide deck as local HTML. Preview in the desk. Not published.",
    playbookKey: "deck_builder",
    action: "build_deck",
    message:
      "Build a short pitch deck from the Brand Kit. Return a complete HTML slide deck the desk can preview. Do not publish.",
    roleHint: "Website",
    featured: true,
  },
  {
    id: "tpl-linkedin-outreach",
    title: "LinkedIn-style outreach",
    blurb:
      "Browse a public page, extract text, draft DMs. Yes/No pause first. Does not send.",
    playbookKey: "linkedin_outreach_draft",
    action: "linkedin_outreach_draft",
    message:
      "Browse this public page (or the Brand Kit site), extract who they are, then draft LinkedIn-style outreach. Ask me Yes/No before drafting. Do not send.",
    roleHint: "Sales",
    featured: true,
  },
  {
    id: "tpl-inbox-invoices",
    title: "Inbox invoice finder",
    blurb:
      "List invoices from connected Gmail. QuickBooks write is TODO. Does not send.",
    playbookKey: "inbox_invoices",
    action: "inbox_invoices",
    message:
      "Find invoices in connected Gmail (invoice, receipt, or bill). List them. Do not send. Do not write to QuickBooks.",
    roleHint: "Finance",
    featured: true,
  },
  {
    id: "tpl-prospecting-scan",
    title: "Prospecting scan",
    blurb:
      "Browse a public page, extract who they are, write sourced notes with uncertainty. Does not invent contacts or send.",
    playbookKey: "prospecting_scan",
    action: "prospecting_scan",
    message:
      "Prospecting scan: browse the public URL in this message (or the Brand Kit site), extract who they are, and write sourced notes with uncertainty. Do not invent contacts. Do not send.",
    roleHint: "Sales",
    featured: true,
  },
  {
    id: "tpl-outreach-draft-pack",
    title: "Outreach draft pack",
    blurb:
      "Five outreach drafts from research or a public page. You approve. CINEM Pro does not send.",
    playbookKey: "outreach_draft_pack",
    action: "outreach_draft_pack",
    message:
      "Outreach draft pack: from the latest research or this public page, write 5 outreach drafts. Pause for approval. Do not send.",
    roleHint: "Sales",
    featured: true,
  },
  {
    id: "tpl-weekly-client-brief",
    title: "Weekly client brief",
    blurb:
      "Sourced weekly brief from a public page. Cite sources. Does not invent results or email the client.",
    playbookKey: "weekly_client_brief",
    action: "weekly_client_brief",
    message:
      "Weekly client brief: browse the public URL (or Brand Kit site) and write a sourced weekly brief. Cite sources. Do not invent results. Pause for approval.",
    roleHint: "Research",
    featured: true,
  },
  {
    id: "tpl-daily-client-brief",
    title: "Daily client brief",
    blurb:
      "Parallel tabs on public URLs, then a sourced daily brief. Cite sources. Does not email the client.",
    playbookKey: "daily_client_brief",
    action: "daily_client_brief",
    message:
      "Daily client brief: open the public URLs in this message (or the Brand Kit site) in parallel tabs and write a sourced daily brief. Cite sources. Do not invent results. Do not email the client.",
    roleHint: "Research",
    featured: true,
  },
  {
    id: "tpl-seo-brief",
    title: "SEO brief",
    blurb:
      "Parallel tabs on the client site, then a sourced SEO brief. Does not invent rankings.",
    playbookKey: "seo_brief",
    action: "seo_brief",
    message:
      "SEO brief: open the public URLs in this message (or the Brand Kit site) in parallel tabs and write a sourced SEO brief. Cite sources. Do not invent rankings.",
    roleHint: "Research",
    featured: true,
  },
  {
    id: "tpl-multi-tab-research",
    title: "Multi-tab research",
    blurb:
      "Paste 5–10 public URLs. Opens them in parallel on-device tabs (DOM-first, allowlist). Does not invent sources.",
    playbookKey: "multi_tab_research",
    action: "multi_tab_research",
    message:
      "Multi-tab research: open the public URLs in this message (paste 5–10) in parallel tabs, snapshot each, write sourced notes. Do not invent sources. Do not send.",
    roleHint: "Research",
    featured: true,
  },
  {
    id: "tpl-client-named-email",
    title: "Client-named email",
    blurb:
      "Draft a client-named email, then pause. Gmail draft only after approval. Never sends.",
    playbookKey: "client_named_email",
    action: "client_named_email",
    message:
      "Draft a client-named email from the Brand Kit and latest research. Pause for approval before creating a Gmail draft. Do not send.",
    roleHint: "Sales",
    featured: true,
  },
  {
    id: "tpl-follow-up-sequence",
    title: "Follow-up sequence",
    blurb: "Five follow-up drafts from research. You approve. CINEM Pro does not send.",
    playbookKey: "follow_up_sequence",
    action: "follow_up_sequence",
    message:
      "Write a 5-touch follow-up sequence from the latest research or Brand Kit. Pause for approval. Do not send.",
    roleHint: "Sales",
    featured: true,
  },
  {
    id: "tpl-competitor-watch",
    title: "Competitor watch",
    blurb:
      "Parallel tabs on competitor URLs, sourced watch note. Does not invent metrics.",
    playbookKey: "competitor_watch",
    action: "competitor_watch",
    message:
      "Competitor watch: open the public competitor URLs in this message in parallel tabs and write a sourced watch note. Do not invent metrics.",
    roleHint: "Research",
    featured: true,
  },
  {
    id: "tpl-talent-sourcing",
    title: "Talent sourcing",
    blurb:
      "Optional for talent agencies: extract public roles into a markdown sheet. Does not email anyone.",
    playbookKey: "talent_sourcing",
    action: "talent_sourcing",
    message:
      "Talent sourcing: browse the public careers or about URL, extract visible roles, fill a markdown sheet. Do not email anyone.",
    roleHint: "Sales",
    featured: true,
  },
];

export function getJobTemplate(id: string) {
  return FEATURED_JOB_TEMPLATES.find((row) => row.id === id) ?? null;
}

export function templateByPlaybook(playbookKey: string) {
  return FEATURED_JOB_TEMPLATES.find((row) => row.playbookKey === playbookKey) ?? null;
}
