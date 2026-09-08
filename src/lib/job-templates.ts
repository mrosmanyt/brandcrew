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
];

export function getJobTemplate(id: string) {
  return FEATURED_JOB_TEMPLATES.find((row) => row.id === id) ?? null;
}

export function templateByPlaybook(playbookKey: string) {
  return FEATURED_JOB_TEMPLATES.find((row) => row.playbookKey === playbookKey) ?? null;
}
