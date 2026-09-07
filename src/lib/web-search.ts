const TAVILY_URL = "https://api.tavily.com/search";

export async function tavilySearch(input: {
  apiKey: string;
  query: string;
}): Promise<{ ok: boolean; query: string; text: string; error?: string }> {
  const query = input.query.trim();
  if (!query) {
    return { ok: false, query, text: "", error: "No search query." };
  }
  try {
    const res = await fetch(TAVILY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(12_000),
      body: JSON.stringify({
        api_key: input.apiKey,
        query,
        max_results: 5,
        include_answer: true,
      }),
    });
    const data = (await res.json()) as {
      answer?: string;
      results?: { title?: string; url?: string; content?: string }[];
      error?: string;
    };
    if (!res.ok) {
      return {
        ok: false,
        query,
        text: "",
        error: data.error || `Tavily HTTP ${res.status}`,
      };
    }
    const lines: string[] = [];
    if (data.answer?.trim()) lines.push(`Answer: ${data.answer.trim()}`);
    for (const hit of data.results ?? []) {
      const title = hit.title?.trim() || hit.url || "Result";
      const url = hit.url?.trim() || "";
      const content = hit.content?.trim() || "";
      lines.push(`## ${title}\n${url}\n${content}`);
    }
    const text = lines.join("\n\n").slice(0, 12_000);
    if (!text) {
      return { ok: false, query, text: "", error: "Tavily returned no results." };
    }
    return { ok: true, query, text };
  } catch (error) {
    return {
      ok: false,
      query,
      text: "",
      error: error instanceof Error ? error.message : "Search failed.",
    };
  }
}
