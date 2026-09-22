/**
 * Static case-study content. No CMS/DB — copy changes rarely, mirrors
 * integrations-showcase.ts / bot-covers.ts as a plain content module.
 *
 * Only real, honest entries go here — no fabricated client names, quotes,
 * or metrics. Until outside clients agree to be named, the one entry below
 * is CINEM's own dogfooding story, described plainly as that.
 */
export type CaseStudy = {
  slug: string;
  client: string;
  industry: string;
  summary: string;
  /** One-line headline stat shown on the index card, e.g. "3x faster drafts". */
  stat: string;
  challenge: string;
  approach: string;
  results: string[];
  quote?: {
    body: string;
    name: string;
    title: string;
  };
};

export const CASE_STUDIES: CaseStudy[] = [
  {
    slug: "cinem-on-cinem",
    client: "CINEM, on CINEM Pro",
    industry: "Dogfooding — our own team",
    summary:
      "Before we sell CINEM Pro to anyone else, our own support, marketing, and ops work runs through it. This is that story, not a client's.",
    stat: "Every support reply and job in this product runs through the same desk you'd get",
    challenge:
      "Small team, constant context-switching: support threads, marketing copy, scheduled recaps, and repetitive setup jobs (invite links, workspace checks) that used to mean digging through the same steps by hand every time.",
    approach:
      "Agents in Mission Control handle the recurring work — drafts wait for a human to approve before anything sends. Routines turn a job we've already approved once into a macro we replay on demand, instead of re-typing the same instructions. Scheduled jobs handle the weekly recap that used to be a Monday-morning chore. None of it auto-sends: every Slack post, email, and public reply still needs an explicit approve.",
    results: [
      "Weekly recap job runs on a schedule instead of someone remembering to write it",
      "A handful of recurring jobs (invite follow-ups, status checks) are now one-click macros instead of retyped instructions",
      "Every output is a draft a person reviewed — the approve step never got skipped to save time",
    ],
  },
];

export function getCaseStudy(slug: string) {
  return CASE_STUDIES.find((entry) => entry.slug === slug) ?? null;
}
