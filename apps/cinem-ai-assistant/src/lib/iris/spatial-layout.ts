/**
 * Spatial window layout commands — pure parser.
 * e.g. "WhatsApp left, Chrome right" → snap assignments for Windows.
 */

export type SnapSlot = "left" | "right" | "top" | "bottom" | "maximize";

export interface SnapAssignment {
  /** Normalized app id (chrome, whatsapp, edge, …). */
  app: string;
  slot: SnapSlot;
}

const APP_ALIASES: Record<string, string> = {
  whatsapp: "whatsapp",
  wa: "whatsapp",
  chrome: "chrome",
  google: "chrome",
  chromium: "chrome",
  edge: "edge",
  firefox: "firefox",
  explorer: "explorer",
  files: "explorer",
  "file explorer": "explorer",
  notepad: "notepad",
  chatgpt: "chatgpt",
  premiere: "premiere",
};

const SLOT_WORDS: Record<string, SnapSlot> = {
  left: "left",
  right: "right",
  top: "top",
  bottom: "bottom",
  maximize: "maximize",
  full: "maximize",
  fullscreen: "maximize",
};

function normalizeApp(raw: string): string | null {
  const key = raw.trim().toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  if (!key) return null;
  if (APP_ALIASES[key]) return APP_ALIASES[key];
  for (const [alias, id] of Object.entries(APP_ALIASES)) {
    if (key.includes(alias)) return id;
  }
  return null;
}

function normalizeSlot(raw: string): SnapSlot | null {
  const w = raw.trim().toLowerCase();
  return SLOT_WORDS[w] ?? null;
}

/** "snap", "tile", "put X left" style commands. */
export function isSpatialLayoutCommand(text: string): boolean {
  const t = text.toLowerCase();
  if (/\b(snap|tile|arrange|split|layout)\b/.test(t) && /\b(left|right|top|bottom)\b/.test(t)) {
    return true;
  }
  const pairs = parseSpatialLayoutCommand(text);
  return pairs !== null && pairs.length >= 1;
}

/**
 * Parse "WhatsApp left, Chrome right" or "put chrome on the right and whatsapp left".
 * Returns null when no valid app+slot pairs found.
 */
export function parseSpatialLayoutCommand(text: string): SnapAssignment[] | null {
  const t = text.trim();
  if (!t) return null;

  const assignments: SnapAssignment[] = [];
  const seen = new Set<string>();

  const pairRe =
    /\b([\w][\w\s-]{0,24}?)\s+(?:on\s+the\s+)?(left|right|top|bottom|maximize|full(?:\s*screen)?)\b/gi;
  let m: RegExpExecArray | null;
  while ((m = pairRe.exec(t)) !== null) {
    const app = normalizeApp(m[1]);
    const slot = normalizeSlot(m[2]);
    if (!app || !slot || seen.has(app)) continue;
    seen.add(app);
    assignments.push({ app, slot });
  }

  if (assignments.length) return assignments;

  const chunks = t.split(/,| and /i);
  for (const chunk of chunks) {
    const cm = chunk.trim().match(/^(.+?)\s+(left|right|top|bottom|maximize|full)$/i);
    if (!cm) continue;
    const app = normalizeApp(cm[1]);
    const slot = normalizeSlot(cm[2]);
    if (!app || !slot || seen.has(app)) continue;
    seen.add(app);
    assignments.push({ app, slot });
  }

  return assignments.length ? assignments : null;
}

/** Short human summary for chat replies. */
export function formatSpatialLayoutReply(assignments: SnapAssignment[]): string {
  const parts = assignments.map((a) => `${a.app} → ${a.slot}`);
  return `Snapped windows: ${parts.join(", ")}.`;
}
