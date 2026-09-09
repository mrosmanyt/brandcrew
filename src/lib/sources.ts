/**
 * Source attribution + uncertainty on research-like artifacts.
 * Never invents business results — only cites captured pages/search.
 */

export type SourceCitation = {
  url: string;
  title?: string;
  excerpt: string;
  engine?: string;
  ok: boolean;
};

export type UncertaintyLevel = "low" | "medium" | "high";

export type ResearchMeta = {
  sources: SourceCitation[];
  uncertainty: UncertaintyLevel;
  uncertaintyNote: string;
};

type PageLike = {
  url?: string;
  title?: string;
  text?: string;
  excerpt?: string;
  engine?: string;
  ok?: boolean;
};

export function citationsFromPages(pages: PageLike[] | undefined): SourceCitation[] {
  const out: SourceCitation[] = [];
  const seen = new Set<string>();
  for (const page of pages || []) {
    const url = String(page.url || "").trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    const excerpt = (page.excerpt || page.text || "").replace(/\s+/g, " ").trim().slice(0, 220);
    out.push({
      url,
      title: page.title?.trim() || undefined,
      excerpt: excerpt || "(no text captured)",
      engine: page.engine,
      ok: page.ok !== false,
    });
  }
  return out;
}

export function uncertaintyFromEvidence(input: {
  live: boolean;
  pages?: PageLike[];
  searchOk?: boolean;
}): { level: UncertaintyLevel; note: string } {
  const pages = input.pages || [];
  const okPages = pages.filter((page) => page.ok !== false && (page.text || page.excerpt));
  if (!input.live) {
    return {
      level: "high",
      note: "Offline demo — labeled template from the Brand Kit, not a live page read. Do not treat as verified research.",
    };
  }
  if (!okPages.length && !input.searchOk) {
    return {
      level: "high",
      note: "No page text or search hits were captured. Do not invent quotes, metrics, or testimonials.",
    };
  }
  const partial = pages.some((page) => page.ok === false);
  if (partial || okPages.length < pages.length) {
    return {
      level: "medium",
      note: "Some URLs were partial or failed. Cite only the lines that were actually captured.",
    };
  }
  return {
    level: "low",
    note: "Notes are grounded in captured page text. Still verify before any outbound send — CINEM Pro is supervised.",
  };
}

export function formatResearchMetaMarkdown(meta: ResearchMeta): string {
  const rows = meta.sources.length
    ? meta.sources
        .map((source, index) => {
          const title = source.title ? ` — ${source.title}` : "";
          const engine = source.engine ? ` (${source.engine}${source.ok ? "" : ", partial"})` : "";
          return `${index + 1}. ${source.url}${title}${engine}\n   > ${source.excerpt}`;
        })
        .join("\n")
    : "_No URLs were captured. Nothing below should be treated as a live source._";
  return `## Sources
${rows}

## Uncertainty
**${meta.uncertainty}** — ${meta.uncertaintyNote}
`;
}

export function appendResearchMeta(
  content: string,
  input: { live: boolean; pages?: PageLike[]; searchOk?: boolean },
): { content: string; meta: ResearchMeta } {
  const sources = citationsFromPages(input.pages);
  const uncertainty = uncertaintyFromEvidence(input);
  const meta: ResearchMeta = {
    sources,
    uncertainty: uncertainty.level,
    uncertaintyNote: uncertainty.note,
  };
  if (/^## Sources\b/m.test(content)) {
    return { content, meta };
  }
  const block = formatResearchMetaMarkdown(meta);
  const trimmed = content.trimEnd();
  return { content: trimmed ? `${trimmed}\n\n${block}` : block, meta };
}
