/**
 * Static case-study content. No CMS/DB — copy changes rarely, mirrors
 * integrations-showcase.ts / bot-covers.ts as a plain content module.
 * Entries below are placeholders; real client copy lands here later.
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
    slug: "placeholder-agency",
    client: "Placeholder Agency",
    industry: "Marketing agency",
    summary: "Replace with a real client outcome once copy is ready.",
    stat: "— pending —",
    challenge: "Describe the problem the client had before CINEM Pro.",
    approach: "Describe which agents/jobs/routines solved it.",
    results: ["Pending metric 1", "Pending metric 2"],
  },
];

export function getCaseStudy(slug: string) {
  return CASE_STUDIES.find((entry) => entry.slug === slug) ?? null;
}
