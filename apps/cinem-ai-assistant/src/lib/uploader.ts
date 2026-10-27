/**
 * Multi-platform uploader — YouTube, Instagram, TikTok, Facebook.
 * Talks to the Playwright sidecar (7878) which automates each platform in its
 * own persistent login profile. Per-platform SEO is generated with the LLM.
 */
import { chatLLM } from "@/lib/llm";
import type { Settings } from "@/store/useSettingsStore";

const IS_TAURI = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
const BASE = "http://127.0.0.1:7878";

export type Platform = "youtube" | "instagram" | "tiktok" | "facebook";

export const PLATFORMS: { id: Platform; label: string }[] = [
  { id: "youtube", label: "YouTube" },
  { id: "instagram", label: "Instagram Reels" },
  { id: "tiktok", label: "TikTok" },
  { id: "facebook", label: "Facebook" },
];

async function pwFetch(path: string, body?: unknown, timeoutMs = 120000): Promise<Response> {
  const doFetch = IS_TAURI ? (await import("@tauri-apps/plugin-http")).fetch : window.fetch.bind(window);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await doFetch(`${BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(t);
  }
}

export async function sidecarUp(): Promise<boolean> {
  try {
    const doFetch = IS_TAURI ? (await import("@tauri-apps/plugin-http")).fetch : window.fetch.bind(window);
    return (await doFetch(`${BASE}/health`)).ok;
  } catch { return false; }
}

/** Opens the platform so the user logs in once (session persists). */
export async function connectPlatform(platform: Platform): Promise<void> {
  // Make sure the Playwright sidecar is running before we ask it to connect.
  const { ensureSidecar, PW_HEALTH } = await import("@/lib/sidecars");
  await ensureSidecar(PW_HEALTH);
  await pwFetch("/social/connect", { platform }, 20000);
}

export async function platformStatus(platform: Platform): Promise<boolean> {
  try {
    const r = await pwFetch("/social/status", { platform }, 8000);
    const d = await r.json();
    return !!d.connected;
  } catch { return false; }
}

export interface PlatformSeo {
  title: string;
  caption: string;
  hashtags: string[];
  bestTime: string;
}

/** Generates platform-specific SEO (title, caption, hashtags, best time). */
export async function generateSeo(
  platforms: Platform[], topic: string, s: Settings,
): Promise<Record<string, PlatformSeo>> {
  const prompt = `You are a viral social-media SEO expert. For this video, write OPTIMIZED metadata for each platform.
Video topic/description: """${topic || "a short engaging video"}"""

Return ONLY JSON in this exact shape (one entry per requested platform):
{${platforms.map((p) => `"${p}":{"title":"","caption":"","hashtags":["#tag"],"bestTime":""}`).join(",")}}

Rules per platform:
- youtube: catchy <70-char title, keyword-rich 2-3 line description, 8-12 tags, bestTime = ideal upload time.
- instagram: punchy hook caption with line breaks + emojis, 15-20 trending reels hashtags.
- tiktok: short hook caption, 5-8 trending hashtags, mention a trending-sound idea in caption.
- facebook: friendly engaging caption + a question, 5-8 hashtags.`;

  const raw = await chatLLM(prompt, s, { json: true, temperature: 0.7, maxTokens: 1400 });
  const match = raw.match(/\{[\s\S]*\}/);
  const parsed = match ? JSON.parse(match[0]) : {};
  const out: Record<string, PlatformSeo> = {};
  for (const p of platforms) {
    const e = parsed[p] ?? {};
    out[p] = {
      title: String(e.title ?? topic ?? "New video").slice(0, 100),
      caption: String(e.caption ?? topic ?? ""),
      hashtags: Array.isArray(e.hashtags) ? e.hashtags.map(String) : [],
      bestTime: String(e.bestTime ?? "Evening (peak hours)"),
    };
  }
  return out;
}

export interface UploadResult { ok: boolean; stage?: string; message?: string; error?: string }

export async function uploadVideo(platform: Platform, file: string, seo: PlatformSeo): Promise<UploadResult> {
  try {
    const r = await pwFetch("/social/upload", {
      platform, file,
      title: seo.title, caption: seo.caption, hashtags: seo.hashtags,
    });
    return (await r.json()) as UploadResult;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/* ── Intent ────────────────────────────────────────────────────────── */

export interface UploadIntent { platforms: Platform[] }

export function matchUploadIntent(text: string): UploadIntent | null {
  const t = text.toLowerCase();
  if (!/\b(upload|post|publish|share|daal|daalo|chadha)\b/.test(t)) return null;

  if (/\b(all|sab|saare|sare|every|sabhi)\b/.test(t) || /all channels|all platforms/.test(t)) {
    return { platforms: PLATFORMS.map((p) => p.id) };
  }
  const picked: Platform[] = [];
  if (/\b(youtube|yt)\b/.test(t)) picked.push("youtube");
  if (/\b(instagram|insta|ig|reel|reels)\b/.test(t)) picked.push("instagram");
  if (/\b(tiktok|tik tok)\b/.test(t)) picked.push("tiktok");
  if (/\b(facebook|fb)\b/.test(t)) picked.push("facebook");
  return picked.length ? { platforms: picked } : null;
}
