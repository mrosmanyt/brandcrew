const HTML_FENCE = /```(?:html|htm|svg)?\s*([\s\S]*?)```/i;

export function looksLikeHtml(text: string): boolean {
  const value = text.trim();
  if (!value) return false;
  if (HTML_FENCE.test(value)) return true;
  return /<!doctype html|<html[\s>]|<body[\s>]/i.test(value);
}

export function isPreviewableArtifact(type?: string | null, content?: string | null): boolean {
  const kind = (type || "").toLowerCase();
  if (kind === "website" || kind === "app" || kind === "deck" || kind === "html") return true;
  return looksLikeHtml(content || "");
}

export function extractPreviewHtml(content: string): string | null {
  const trimmed = content.trim();
  if (!trimmed) return null;
  const fenced = trimmed.match(HTML_FENCE);
  if (fenced?.[1]?.trim()) {
    return sanitizePreviewHtml(fenced[1].trim());
  }
  if (/<!doctype html|<html[\s>]/i.test(trimmed)) {
    return sanitizePreviewHtml(trimmed);
  }
  if (/<body[\s>]|<div[\s>]|<main[\s>]/i.test(trimmed) && /<\/[a-z]+>/i.test(trimmed)) {
    return sanitizePreviewHtml(wrapFragment(trimmed));
  }
  return null;
}

function wrapFragment(fragment: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0;font-family:ui-sans-serif,system-ui,sans-serif;}</style></head><body>${fragment}</body></html>`;
}

/** Keep CSS/layout; drop script/event handlers so srcdoc cannot phone home. */
export function sanitizePreviewHtml(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/javascript:/gi, "");
}

/**
 * Website-builder preview (Package 11b). Owner decision 2026-11-22: small
 * inline interactivity IS allowed — working menus, filters and sliders make
 * a generated site feel alive. So unlike sanitizePreviewHtml this keeps the
 * page's own inline <script> blocks and inline event handlers, and only
 * strips what could reach outside the page:
 * - external scripts (any <script src=…>) — no outside code, no trackers
 * - nested frames/objects/embeds and <base> — the page cannot embed or
 *   re-base other content
 * - meta refresh and javascript: URLs — no forced navigation
 * The result is only ever rendered inside an iframe with
 * sandbox="allow-scripts" and NO allow-same-origin, so the page's code can
 * never read the app's cookies, storage or DOM around it.
 */
export function sanitizeBuilderPreviewHtml(html: string): string {
  return html
    .replace(/<script\b[^>]*\bsrc\s*=[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<script\b[^>]*\bsrc\s*=[^>]*\/?>/gi, "")
    .replace(/<(iframe|object|embed|base)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<(iframe|object|embed|base)\b[^>]*\/?>/gi, "")
    .replace(/<meta\b[^>]*http-equiv\s*=\s*["']?refresh[^>]*>/gi, "")
    .replace(/javascript:/gi, "");
}

export function replitHookConfigured(): boolean {
  return Boolean(
    process.env.REPLIT_CONNECT_URL?.trim() || process.env.REPLIT_API_TOKEN?.trim(),
  );
}
