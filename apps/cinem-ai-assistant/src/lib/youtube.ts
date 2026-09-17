/**
 * YouTube Data API v3 client — powers the Cinem AI Assistant Player.
 * Uses tauri-plugin-http in the desktop app (no CORS); window.fetch in
 * browser dev (YouTube API allows browser calls).
 */
import {
  youtubeEmbedSearchUrl,
  youtubeEmbedWatchUrl,
} from "@/lib/browserIntents";
import { searchYouTubeViaWeb } from "@/lib/publicWebSearch";
import type { Settings } from "@/store/useSettingsStore";

const IS_TAURI = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export interface YtVideo {
  id: string;
  title: string;
  channel: string;
  thumbnail: string;
  /** Full embed URL when we are not using a single /embed/VIDEO_ID watch. */
  embedUrl?: string;
}

/** Decodes HTML entities the API returns in titles (&amp;quot; etc.). */
function decodeEntities(s: string): string {
  const el = document.createElement("textarea");
  el.innerHTML = s;
  return el.value;
}

/** Searches YouTube and returns playable video results (best match first). */
export async function searchYouTube(
  query: string,
  settings: Settings,
  maxResults = 6,
): Promise<YtVideo[]> {
  if (!settings.youtubeKey) {
    throw new Error("No YouTube API key set — add one in Settings → API.");
  }

  const doFetch = IS_TAURI
    ? (await import("@tauri-apps/plugin-http")).fetch
    : window.fetch.bind(window);

  const url =
    "https://www.googleapis.com/youtube/v3/search" +
    `?part=snippet&type=video&videoEmbeddable=true&maxResults=${maxResults}` +
    `&q=${encodeURIComponent(query)}&key=${settings.youtubeKey}`;

  const res = await doFetch(url);
  if (!res.ok) throw new Error(`YouTube API ${res.status}: ${await res.text()}`);

  const data = await res.json();
  const items: YtVideo[] = (data.items ?? [])
    .filter((it: { id?: { videoId?: string } }) => it.id?.videoId)
    .map(
      (it: {
        id: { videoId: string };
        snippet: { title: string; channelTitle: string; thumbnails?: { medium?: { url?: string } } };
      }) => ({
        id: it.id.videoId,
        title: decodeEntities(it.snippet.title),
        channel: decodeEntities(it.snippet.channelTitle),
        thumbnail: it.snippet.thumbnails?.medium?.url ?? "",
      }),
    );

  if (!items.length) throw new Error(`No YouTube results for "${query}".`);
  return items;
}

/**
 * API key when set; otherwise DuckDuckGo site:youtube.com scrape; finally embed-search fallback.
 */
export async function searchYouTubeWithFallback(
  query: string,
  settings: Settings,
  maxResults = 6,
): Promise<YtVideo[]> {
  if (settings.youtubeKey) {
    try {
      return await searchYouTube(query, settings, maxResults);
    } catch {
      /* fall through */
    }
  }
  try {
    const web = await searchYouTubeViaWeb(query, maxResults);
    if (web.length) {
      return web.map((v) => ({
        id: v.id,
        title: v.title,
        channel: "YouTube",
        thumbnail: `https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`,
        embedUrl: youtubeEmbedWatchUrl(v.id),
      }));
    }
  } catch {
    /* fall through */
  }
  return [
    {
      id: `search:${query.slice(0, 80)}`,
      title: query,
      channel: "YouTube",
      thumbnail: "",
      embedUrl: youtubeEmbedSearchUrl(query),
    },
  ];
}

/** Fetches currently-trending YouTube videos (real "recent media" for the
 *  Media Link sidebar when there's no play history yet). */
export async function trendingYouTube(
  settings: Settings,
  maxResults = 6,
): Promise<YtVideo[]> {
  if (!settings.youtubeKey) {
    throw new Error("No YouTube API key set — add one in Settings → API.");
  }

  const doFetch = IS_TAURI
    ? (await import("@tauri-apps/plugin-http")).fetch
    : window.fetch.bind(window);

  const url =
    "https://www.googleapis.com/youtube/v3/videos" +
    `?part=snippet&chart=mostPopular&maxResults=${maxResults}` +
    `&regionCode=US&key=${settings.youtubeKey}`;

  const res = await doFetch(url);
  if (!res.ok) throw new Error(`YouTube API ${res.status}: ${await res.text()}`);

  const data = await res.json();
  return (data.items ?? [])
    .filter((it: { id?: string }) => typeof it.id === "string")
    .map(
      (it: {
        id: string;
        snippet: { title: string; channelTitle: string; thumbnails?: { medium?: { url?: string } } };
      }) => ({
        id: it.id,
        title: decodeEntities(it.snippet.title),
        channel: decodeEntities(it.snippet.channelTitle),
        thumbnail: it.snippet.thumbnails?.medium?.url ?? "",
      }),
    );
}
