/**
 * Decide what gets persisted as an artifact.
 * Live (any provider key): model text, else tool-captured page text — never canned demo copy.
 * Offline demo (zero keys): labeled templates only.
 */
export type FetchedPage = { url: string; ok: boolean; text: string };

export function notesFromFetchedPage(fetched: FetchedPage): string {
  const body = fetched.text.trim() || "(no text captured from this URL)";
  return `# Source notes

## URL
${fetched.url}
${fetched.ok ? "Fetched." : "Partial or failed fetch — text may be incomplete."}

## Page text
${body}
`;
}

export function notesFromBrowsedPages(pages: FetchedPage[]): string {
  const sections = pages.map((page) => {
    const body = page.text.trim() || "(no text captured from this URL)";
    return `## ${page.url}
${page.ok ? "Browsed (read-only)." : "Partial or failed read."}

${body}`;
  });
  return `# Source notes

Read-only browse. No login. Nothing was sent.

${sections.join("\n\n")}
`;
}

export function resolveRunOutput(input: {
  live: boolean;
  llmTitle?: string;
  llmContent?: string;
  fetched?: FetchedPage;
  pages?: FetchedPage[];
  search?: { query: string; text: string };
  demoTitle: string;
  demoContent: string;
}): { title: string; content: string; source: "llm" | "tools" | "demo" } {
  const llmContent = input.llmContent?.trim() || "";
  const llmTitle = input.llmTitle?.trim() || "";
  if (input.live) {
    if (llmContent) {
      return {
        title: llmTitle || "Draft",
        content: llmContent,
        source: "llm",
      };
    }
    const pagesWithText = (input.pages || []).filter((page) => page.text?.trim());
    if (pagesWithText.length) {
      return {
        title: llmTitle || "Notes from browsed pages",
        content: notesFromBrowsedPages(pagesWithText),
        source: "tools",
      };
    }
    if (input.fetched?.text?.trim()) {
      return {
        title: llmTitle || `Notes from ${input.fetched.url}`,
        content: notesFromFetchedPage(input.fetched),
        source: "tools",
      };
    }
    if (input.search?.text?.trim()) {
      return {
        title: llmTitle || `Search notes: ${input.search.query}`,
        content: `# Search notes\n\n## Query\n${input.search.query}\n\n## Results\n${input.search.text}`,
        source: "tools",
      };
    }
    throw new Error("Live job produced no model or tool output.");
  }
  return {
    title: llmTitle || input.demoTitle,
    content: llmContent || input.demoContent,
    source: "demo",
  };
}

export function resolveLivePosts(input: {
  live: boolean;
  posts: { title: string; body: string }[];
  demoPosts: { title: string; body: string }[];
}): { title: string; body: string }[] {
  if (!input.live) {
    return input.posts.length ? input.posts : input.demoPosts;
  }
  if (input.posts.length) return input.posts;
  throw new Error("Live job produced no posts from the model.");
}
