/**
 * Web search for the chat product: Tavily (key already in server env),
 * structured so the chat can inject cited context into the turn and show
 * the source list under the reply. When the key is missing the caller
 * answers an honest `search_not_configured` — search is never faked.
 */

export type ChatSearchSource = { title: string; url: string };

export type ChatSearchResult = {
  ok: boolean;
  sources: ChatSearchSource[];
  /** Numbered context block for the system prompt. */
  contextText: string;
  /** Raw result excerpts, parallel to `sources` (deep research rebuilds
   * its own globally-numbered context from these). */
  excerpts: string[];
  error?: string;
};

export function chatSearchConfigured(): boolean {
  return Boolean(process.env.TAVILY_API_KEY?.trim());
}

export const SEARCH_NOT_CONFIGURED_MESSAGE =
  "Web search isn't configured yet — the search API key has not been added to the server environment.";

/** Flat credit metering per chat search, same spirit as voice/images. */
export const SEARCH_USAGE_TOKENS = 250;

const TAVILY_URL = "https://api.tavily.com/search";

export async function searchForChat(queryRaw: string): Promise<ChatSearchResult> {
  const apiKey = process.env.TAVILY_API_KEY?.trim() || "";
  const query = queryRaw.trim().slice(0, 400);
  if (!apiKey) {
    return { ok: false, sources: [], contextText: "", excerpts: [], error: SEARCH_NOT_CONFIGURED_MESSAGE };
  }
  if (!query) {
    return { ok: false, sources: [], contextText: "", excerpts: [], error: "Nothing to search for." };
  }
  let res: Response;
  try {
    res = await fetch(TAVILY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(15_000),
      body: JSON.stringify({
        api_key: apiKey,
        query,
        max_results: 5,
        include_answer: true,
        search_depth: "basic",
      }),
    });
  } catch {
    return { ok: false, sources: [], contextText: "", excerpts: [], error: "Could not reach the search service. Try again." };
  }
  const data = (await res.json().catch(() => ({}))) as {
    answer?: string;
    results?: { title?: string; url?: string; content?: string }[];
    error?: string;
  };
  if (!res.ok) {
    return {
      ok: false,
      sources: [],
      contextText: "",
      excerpts: [],
      error:
        res.status === 401 || res.status === 403
          ? "The search API key was rejected. Web search stays off until a working key is added."
          : data.error || `Search failed (HTTP ${res.status}).`,
    };
  }
  const hits = (data.results ?? []).filter((hit) => hit.url?.trim());
  if (!hits.length) {
    return { ok: false, sources: [], contextText: "", excerpts: [], error: "The search returned no results. Try rephrasing." };
  }
  const sources: ChatSearchSource[] = hits.map((hit) => ({
    title: hit.title?.trim() || hit.url!.trim(),
    url: hit.url!.trim(),
  }));
  const lines: string[] = [
    "Web search results for the user's latest message (fetched just now). Use them when they are relevant, prefer them over stale memory for current facts, and cite sources inline like [1], [2] matching this list:",
  ];
  if (data.answer?.trim()) lines.push(`Summary answer: ${data.answer.trim()}`);
  hits.forEach((hit, index) => {
    const excerpt = (hit.content ?? "").trim().slice(0, 1200);
    lines.push(`[${index + 1}] ${sources[index].title}\n${sources[index].url}\n${excerpt}`);
  });
  return {
    ok: true,
    sources,
    contextText: lines.join("\n\n").slice(0, 10_000),
    excerpts: hits.map((hit) => (hit.content ?? "").trim().slice(0, 2000)),
  };
}
