export const DESK_THEME_STORAGE_KEY = "cinem-desk-theme";

export type DeskTheme = "light" | "dark";

/** Stored next-themes value, including `system` before it is resolved. */
export type StoredDeskTheme = DeskTheme | "system";

/**
 * Resolve the desk appearance.
 * Saved Light/Dark always wins. If unset (or `system`), follow the OS.
 * Unknown / missing system preference defaults to dark — the current product look.
 */
export function resolveDeskTheme(
  stored: string | null | undefined,
  systemPrefersDark?: boolean,
): DeskTheme {
  if (stored === "light" || stored === "dark") return stored;
  if (systemPrefersDark === false) return "light";
  return "dark";
}

export function isDeskTheme(value: string | null | undefined): value is DeskTheme {
  return value === "light" || value === "dark";
}
