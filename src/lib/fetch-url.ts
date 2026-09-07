const PRIVATE_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "[::1]",
]);

const MAX_BYTES = 80_000;
const MAX_TEXT_CHARS = 12_000;

export function extractUrls(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s<>"']+/gi) ?? [];
  return matches.map((url) => url.replace(/[),.;]+$/, ""));
}

export function assertPublicHttpUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("That does not look like a URL.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http and https URLs can be fetched.");
  }
  const host = url.hostname.toLowerCase();
  if (PRIVATE_HOSTS.has(host) || host.endsWith(".localhost")) {
    throw new Error("Local URLs are blocked.");
  }
  if (host.endsWith(".local") || host.endsWith(".internal")) {
    throw new Error("Private hostnames are blocked.");
  }
  if (isPrivateIp(host)) {
    throw new Error("Private IP addresses are blocked.");
  }
  return url;
}

export function isPrivateIp(host: string) {
  if (/^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
  if (/^0\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
  if (/^169\.254\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
  return false;
}

export function htmlToText(html: string, maxChars = MAX_TEXT_CHARS): string {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
  return text.slice(0, maxChars);
}

export function extractHtmlLinks(html: string, baseUrl: string, max = 20): string[] {
  const found: string[] = [];
  const seen = new Set<string>();
  const hrefs = html.matchAll(/\bhref\s*=\s*["']([^"']+)["']/gi);
  for (const match of hrefs) {
    const href = match[1]?.trim() ?? "";
    if (!href || href.startsWith("#") || href.startsWith("javascript:") || href.startsWith("mailto:")) {
      continue;
    }
    try {
      const resolved = new URL(href, baseUrl);
      const hrefUrl = assertPublicHttpUrl(resolved.toString());
      const normalized = hrefUrl.toString();
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      found.push(normalized);
      if (found.length >= max) break;
    } catch {
      // skip blocked or invalid
    }
  }
  return found;
}

export type FetchedPage = {
  url: string;
  ok: boolean;
  text: string;
  links: string[];
  error?: string;
};

export async function fetchUrlText(rawUrl: string): Promise<FetchedPage> {
  try {
    const url = assertPublicHttpUrl(rawUrl);
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
      headers: {
        Accept: "text/html,text/plain;q=0.9,*/*;q=0.1",
        "User-Agent": "BrandcrewResearch/0.2 (+https://github.com/mrosmanyt/brandcrew)",
      },
    });
    const buffer = await response.arrayBuffer();
    const slice = buffer.byteLength > MAX_BYTES ? buffer.slice(0, MAX_BYTES) : buffer;
    const raw = new TextDecoder("utf-8", { fatal: false }).decode(slice);
    const contentType = response.headers.get("content-type") || "";
    const looksHtml = /html/i.test(contentType) || /<\/?[a-z][\s\S]*>/i.test(raw);
    const text = looksHtml
      ? htmlToText(raw)
      : raw.replace(/\s+/g, " ").trim().slice(0, MAX_TEXT_CHARS);
    const finalUrl = response.url || url.toString();
    try {
      assertPublicHttpUrl(finalUrl);
    } catch (error) {
      return {
        url: rawUrl,
        ok: false,
        text: "",
        links: [],
        error: error instanceof Error ? error.message : "Redirect blocked",
      };
    }
    const links = looksHtml ? extractHtmlLinks(raw, finalUrl) : [];
    if (!response.ok) {
      return {
        url: finalUrl,
        ok: false,
        text,
        links,
        error: `HTTP ${response.status}`,
      };
    }
    return { url: finalUrl, ok: true, text, links };
  } catch (error) {
    return {
      url: rawUrl,
      ok: false,
      text: "",
      links: [],
      error: error instanceof Error ? error.message : "Fetch failed",
    };
  }
}
