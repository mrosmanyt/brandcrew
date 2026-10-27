export const DESK_LEFT_PANE = {
  storageKey: "cinem-desk-left-width",
  collapsedKey: "brandcrew-sidebar",
  defaultWidth: 240,
  minWidth: 176,
  maxWidth: 400,
  collapsedWidth: 56,
} as const;

export const DESK_RIGHT_PANE = {
  storageKey: "cinem-desk-right-width",
  collapsedKey: "cinem-desk-right-collapsed",
  defaultWidth: 320,
  minWidth: 240,
  maxWidth: 520,
} as const;

export function clampPaneWidth(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function readStoredPaneWidth(
  raw: string | null,
  fallback: number,
  min: number,
  max: number,
) {
  if (raw == null || raw === "") return fallback;
  return clampPaneWidth(Number(raw), min, max);
}

export function isStoredCollapsed(raw: string | null) {
  return raw === "collapsed" || raw === "1" || raw === "true";
}
