/** Known `/desk/:workspaceId/:section` pages. Unknown segments 404. */

export const DESK_PAGE_SECTIONS = [
  "calendar",
  "ops",
  "marketplace",
  "billing",
  "brand-kit",
  "developers",
  "settings",
  "usage",
  "on-device",
  "clients",
  "trust",
] as const;

export type DeskPageSection = (typeof DESK_PAGE_SECTIONS)[number];

export type DeskSectionResolution =
  | { kind: "mission" }
  | { kind: "page"; section: DeskPageSection }
  | { kind: "not-found" };

export function isDeskPageSection(value: string): value is DeskPageSection {
  return (DESK_PAGE_SECTIONS as readonly string[]).includes(value);
}

export function resolveDeskSection(parts?: string[] | null): DeskSectionResolution {
  const section = parts ?? [];
  if (section.length === 0) return { kind: "mission" };
  if (section.length !== 1) return { kind: "not-found" };
  const head = section[0];
  if (!head || !isDeskPageSection(head)) return { kind: "not-found" };
  return { kind: "page", section: head };
}
