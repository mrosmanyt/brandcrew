/**
 * Smart AI thumbnails — uses the user's OWN Gemini key (zero backend cost).
 *
 * Pipeline (honest): Gemini does NOT paint images. Instead we
 *   1. extract real key frames from the video (ffmpeg sidecar),
 *   2. Gemini Vision analyzes a frame → suggests a punchy overlay hook per style,
 *   3. ffmpeg composites 6 styled, click-worthy thumbnails from the real frame.
 */
import { novaFetch } from "@/lib/nova";
import { chatVision } from "@/lib/llm";
import { ensureSidecar, NOVA_HEALTH } from "@/lib/sidecars";
import type { Settings } from "@/store/useSettingsStore";

export type ThumbStyle =
  | "cinematic" | "clickbait" | "minimal" | "viral" | "professional" | "dark";

export const THUMB_STYLES: { id: ThumbStyle; label: string }[] = [
  { id: "cinematic", label: "Cinematic" },
  { id: "clickbait", label: "Clickbait" },
  { id: "minimal", label: "Minimal" },
  { id: "viral", label: "Viral / Reels" },
  { id: "professional", label: "Professional" },
  { id: "dark", label: "Dark / Mysterious" },
];

interface Frame { path: string; b64: string }
export interface Thumbnail { style: ThumbStyle; label: string; path: string; b64: string }

async function extractFrames(video: string): Promise<Frame[]> {
  const r = await novaFetch("/thumbs", { video, count: 6 }, 30000);
  const d = await r.json();
  if (!d.ok) throw new Error(d.error || "frame extraction failed");
  return d.frames as Frame[];
}

/** Gemini Vision → a short overlay hook for each style (2-4 words). */
async function suggestOverlays(frame: Frame, s: Settings): Promise<Record<ThumbStyle, string>> {
  const prompt = `Yeh ek video ka frame hai. Iske content/mood ko dekh kar har thumbnail style ke liye ek CHHOTA, click-worthy overlay text suggest karo (2-4 words max, ALL CAPS, no emojis).
Return ONLY JSON:
{"cinematic":"","clickbait":"","minimal":"","viral":"","professional":"","dark":""}`;
  try {
    const raw = await chatVision(prompt, frame.b64, s);
    const m = raw.match(/\{[\s\S]*\}/);
    const parsed = m ? JSON.parse(m[0]) : {};
    const out = {} as Record<ThumbStyle, string>;
    for (const { id } of THUMB_STYLES) out[id] = String(parsed[id] ?? "").slice(0, 28);
    return out;
  } catch {
    // Vision unavailable → still produce thumbnails with no text.
    const out = {} as Record<ThumbStyle, string>;
    for (const { id } of THUMB_STYLES) out[id] = "";
    return out;
  }
}

async function compose(frame: string, text: string, style: ThumbStyle): Promise<Thumbnail | null> {
  try {
    const r = await novaFetch("/thumbnail", { frame, text, style }, 30000);
    const d = await r.json();
    if (!d.ok) return null;
    return { style, label: THUMB_STYLES.find((x) => x.id === style)!.label, path: d.path, b64: d.b64 };
  } catch {
    return null;
  }
}

export interface GenProgress { stage: string }

/** Full thumbnail generation. `onStage` streams progress text. */
export async function generateThumbnails(
  video: string, s: Settings, onStage?: (t: string) => void,
): Promise<Thumbnail[]> {
  onStage?.("NOVA engine ready kar raha hoon…");
  if (!(await ensureSidecar(NOVA_HEALTH))) {
    throw new Error("NOVA engine offline — Node + ffmpeg installed hai?");
  }
  onStage?.("Extracting key frames…");
  const frames = await extractFrames(video);
  if (!frames.length) throw new Error("No frames extracted.");

  // Use a representative middle frame as the base + for analysis.
  const base = frames[Math.floor(frames.length / 2)] ?? frames[0];

  onStage?.("Gemini Vision analyzing video…");
  const overlays = await suggestOverlays(base, s);

  onStage?.("Compositing 6 styled thumbnails…");
  const results = await Promise.all(
    THUMB_STYLES.map((st) => compose(base.path, overlays[st.id], st.id)),
  );
  const ok = results.filter((t): t is Thumbnail => !!t);
  if (!ok.length) throw new Error("Thumbnail compositing failed (ffmpeg/font issue).");
  return ok;
}

/* ── Intent ────────────────────────────────────────────────────────── */
export function matchThumbnailIntent(text: string): boolean {
  const t = text.toLowerCase();
  return /\bthumbnail/.test(t) || /\bthumbnails?\b/.test(t) ||
    (/\bthumb/.test(t) && /\b(bana|banao|generate|create|do)\b/.test(t));
}
