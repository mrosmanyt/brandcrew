/**
 * Seasonal Studio preset packs — server side (Package 4).
 *
 * Storage: StudioPresetPack rows (admin-curated in /admin/studio-packs).
 * Resolution: the studios render the built-in code presets as the
 * always-on core pack plus every curated pack that is active and inside
 * its [startsAt, endsAt] window. Any failure (table not migrated yet,
 * DB unreachable) falls back to the built-ins alone, so the studios can
 * never regress because of this feature.
 */
import { prisma } from "@/lib/db";
import {
  getPhotoStudioPreset,
  resolveStudioPresetPacks,
  type PhotoStudioMode,
  type PhotoStudioPreset,
  type StudioPresetPackData,
} from "@/lib/photo-studio-presets";

export type StudioPresetPackRow = {
  id: string;
  slug: string;
  name: string;
  description: string;
  startsAt: Date | null;
  endsAt: Date | null;
  active: boolean;
  sortOrder: number;
  presets: string;
  createdAt: Date;
  updatedAt: Date;
  updatedBy: string;
};

export type StudioPresetPackInput = {
  slug: string;
  name: string;
  description: string;
  startsAt: Date | null;
  endsAt: Date | null;
  active: boolean;
  sortOrder: number;
  presets: PhotoStudioPreset[];
};

const PRESET_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Validate/normalise one preset object coming from stored JSON or an
 * admin save. Returns null when the shape is unusable — readers drop
 * invalid entries instead of breaking the studio.
 */
export function coerceStudioPreset(value: unknown): PhotoStudioPreset | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const id = typeof raw.id === "string" ? raw.id.trim() : "";
  const label = typeof raw.label === "string" ? raw.label.trim() : "";
  const blurb = typeof raw.blurb === "string" ? raw.blurb.trim() : "";
  const editPrompt =
    typeof raw.editPrompt === "string" ? raw.editPrompt.trim() : "";
  const generateSuffix =
    typeof raw.generateSuffix === "string" ? raw.generateSuffix.trim() : "";
  const modesRaw = Array.isArray(raw.modes) ? raw.modes : [];
  const modes = modesRaw.filter(
    (mode): mode is PhotoStudioMode => mode === "edit" || mode === "generate",
  );
  if (!PRESET_ID_PATTERN.test(id)) return null;
  if (!label || modes.length === 0) return null;
  if (modes.includes("edit") && !editPrompt) return null;
  if (modes.includes("generate") && !generateSuffix) return null;
  return {
    id,
    label,
    blurb,
    modes,
    editPrompt,
    generateSuffix,
    ...(raw.seasonal === true ? { seasonal: true } : {}),
  };
}

/** Parse a stored presets JSON column, dropping unusable entries. */
export function parseStudioPresets(raw: string): PhotoStudioPreset[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    const presets: PhotoStudioPreset[] = [];
    for (const entry of parsed) {
      const preset = coerceStudioPreset(entry);
      if (preset && !seen.has(preset.id)) {
        seen.add(preset.id);
        presets.push(preset);
      }
    }
    return presets;
  } catch {
    return [];
  }
}

export function studioPackWindowIsOpen(
  row: { startsAt: Date | null; endsAt: Date | null },
  now: Date,
): boolean {
  if (row.startsAt && row.startsAt.getTime() > now.getTime()) return false;
  if (row.endsAt && row.endsAt.getTime() < now.getTime()) return false;
  return true;
}

/**
 * The packs the studios should render right now: active curated packs
 * inside their date window, merged over the built-in core pack.
 * Never throws — any storage problem resolves to the built-ins alone.
 */
export async function getActiveStudioPresetPacks(
  now: Date = new Date(),
): Promise<StudioPresetPackData[]> {
  try {
    const rows = (await prisma.studioPresetPack.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    })) as StudioPresetPackRow[];
    const curated: StudioPresetPackData[] = rows
      .filter((row) => studioPackWindowIsOpen(row, now))
      .map((row) => ({
        slug: row.slug,
        name: row.name,
        description: row.description,
        seasonal: true,
        presets: parseStudioPresets(row.presets),
      }))
      .filter((pack) => pack.presets.length > 0);
    return resolveStudioPresetPacks(curated);
  } catch {
    return resolveStudioPresetPacks([]);
  }
}

export async function listStudioPresetPacks(): Promise<StudioPresetPackRow[]> {
  return (await prisma.studioPresetPack.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  })) as StudioPresetPackRow[];
}

export async function findStudioPresetPackBySlug(
  slug: string,
): Promise<StudioPresetPackRow | null> {
  return (await prisma.studioPresetPack.findUnique({
    where: { slug },
  })) as StudioPresetPackRow | null;
}

export async function createStudioPresetPack(
  input: StudioPresetPackInput & { updatedBy: string },
): Promise<StudioPresetPackRow> {
  return (await prisma.studioPresetPack.create({
    data: {
      slug: input.slug,
      name: input.name,
      description: input.description,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      active: input.active,
      sortOrder: input.sortOrder,
      presets: JSON.stringify(input.presets),
      updatedBy: input.updatedBy,
    },
  })) as StudioPresetPackRow;
}

export async function updateStudioPresetPack(
  id: string,
  input: StudioPresetPackInput & { updatedBy: string },
): Promise<StudioPresetPackRow> {
  return (await prisma.studioPresetPack.update({
    where: { id },
    data: {
      slug: input.slug,
      name: input.name,
      description: input.description,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      active: input.active,
      sortOrder: input.sortOrder,
      presets: JSON.stringify(input.presets),
      updatedBy: input.updatedBy,
    },
  })) as StudioPresetPackRow;
}

export async function deleteStudioPresetPack(id: string): Promise<void> {
  await prisma.studioPresetPack.delete({ where: { id } });
}

/**
 * First-run seed: when the table is empty, copy the two seasonal
 * built-ins (Eid greeting card, PSL fan poster) into curated packs —
 * inactive and without dates, so nothing changes in the studios until
 * the owner sets a window and switches a pack on. From then on the
 * pack's data shadows the built-in preset with the same id.
 */
export async function ensureStudioPresetPackSeeds(
  actorEmail: string,
): Promise<void> {
  const count = await prisma.studioPresetPack.count();
  if (count > 0) return;
  const seeds: { slug: string; name: string; presetId: string; sortOrder: number }[] = [
    { slug: "eid", name: "Eid", presetId: "eid-card", sortOrder: 10 },
    { slug: "psl", name: "PSL season", presetId: "psl-fan-pack", sortOrder: 20 },
  ];
  for (const seed of seeds) {
    const preset = getPhotoStudioPreset(seed.presetId);
    if (!preset) continue;
    await prisma.studioPresetPack.create({
      data: {
        slug: seed.slug,
        name: seed.name,
        description: "",
        startsAt: null,
        endsAt: null,
        active: false,
        sortOrder: seed.sortOrder,
        presets: JSON.stringify([preset]),
        updatedBy: actorEmail,
      },
    });
  }
}
