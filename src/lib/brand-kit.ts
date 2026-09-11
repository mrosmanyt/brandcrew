import { z } from "zod";

export const brandKitSchema = z.object({
  voice: z.string(),
  audience: z.string(),
  offer: z.string(),
  website: z.string().optional().default(""),
  samplePosts: z.array(z.string()),
  forbiddenWords: z.array(z.string()),
});

export type BrandKit = z.infer<typeof brandKitSchema>;

export const EMPTY_BRAND_KIT: BrandKit = {
  voice: "",
  audience: "",
  offer: "",
  website: "",
  samplePosts: [],
  forbiddenWords: [],
};

/**
 * Shipped sample kit for agency house desks. Positioning is CINEM Pro as an
 * AI employee desk for agencies / operators / knowledge work — not a
 * hospitality-only studio. Client desks still start from EMPTY_BRAND_KIT.
 */
export const DEMO_BRAND_KIT: BrandKit = {
  voice:
    "Warm, specific, and commercially sharp. Sounds like a senior operator on an AI employee desk — not a generic chatbot. Short sentences. Concrete nouns. No hype adjectives.",
  audience:
    "Agencies, operators, and teams who need an AI employee for knowledge work: drafts, research, files, browse, and gated sends — across industries, not a single vertical.",
  offer:
    "CINEM Pro desk. An AI employee desk: Brand Kit, jobs, artifacts, drafts, public-web browse, and Gmail drafts when connected. Help with documents, research, coding, scheduling, and desk work across industries — not a hospitality-only studio.",
  website: "https://example.com",
  samplePosts: [
    "An AI employee desk is not a chatbot tab. It keeps a Brand Kit, runs jobs, and waits for you before anything leaves.",
    "If the brief lives in someone's head and the drafts live in five tools, the work is already split. Put the facts in the Brand Kit and let the desk reuse them.",
  ],
  forbiddenWords: [
    "synergy",
    "disrupt",
    "world-class",
    "leverage",
    "cutting-edge",
    "guru",
    "unlock",
  ],
};

/** Pre-2026-09 default that made every desk Q&A answer hospitality / House Look. */
export const LEGACY_HOSPITALITY_DEMO_BRAND_KIT: BrandKit = {
  voice:
    "Warm, specific, and commercially sharp. Sounds like a senior brand director who has spent time in hotel kitchens — not a generic agency. Short sentences. Concrete nouns. No hype adjectives.",
  audience:
    "Independent hospitality groups (3–20 locations) and regional food producers who need to look as premium as their product.",
  offer:
    "Brand systems, menus, and websites for hospitality groups. Flagship product: an 8-week House Look engagement — positioning, visual system, and a launch kit the floor staff can actually use.",
  website: "https://example.com",
  samplePosts: [
    "A tasting menu is a brand system. Courses have sequence, contrast, and a last impression. Most websites have none of those.",
    "If your rooms photograph well but the booking page reads like a chain, guests feel the mismatch before they ever check in.",
  ],
  forbiddenWords: [
    "synergy",
    "disrupt",
    "world-class",
    "leverage",
    "cutting-edge",
    "guru",
    "unlock",
  ],
};

const LEGACY_HOSPITALITY_MARKERS = [
  "hotel kitchens",
  "Independent hospitality groups (3–20 locations)",
  "House Look engagement",
] as const;

export function isLegacyHospitalityDemoBrandKitRaw(
  raw: string | null | undefined,
): boolean {
  if (!raw) return false;
  return LEGACY_HOSPITALITY_MARKERS.every((marker) => raw.includes(marker));
}

export function isLegacyHospitalityDemoBrandKit(kit: BrandKit): boolean {
  return (
    kit.voice.includes("hotel kitchens") &&
    kit.audience.includes("Independent hospitality groups (3–20 locations)") &&
    kit.offer.includes("House Look engagement")
  );
}

export function resolveBrandKit(kit: BrandKit): BrandKit {
  return isLegacyHospitalityDemoBrandKit(kit) ? { ...DEMO_BRAND_KIT } : kit;
}

function parseBrandKitUnchecked(raw: string | null | undefined): BrandKit {
  if (!raw) return { ...EMPTY_BRAND_KIT };
  try {
    const parsed = JSON.parse(raw);
    const result = brandKitSchema.safeParse({
      voice: parsed.voice ?? "",
      audience: parsed.audience ?? "",
      offer: parsed.offer ?? "",
      website: parsed.website ?? "",
      samplePosts: Array.isArray(parsed.samplePosts) ? parsed.samplePosts : [],
      forbiddenWords: Array.isArray(parsed.forbiddenWords)
        ? parsed.forbiddenWords
        : [],
    });
    return result.success ? result.data : { ...EMPTY_BRAND_KIT };
  } catch {
    return { ...EMPTY_BRAND_KIT };
  }
}

/** Parses stored JSON and remaps the shipped hospitality demo kit to DEMO_BRAND_KIT. */
export function parseBrandKit(raw: string | null | undefined): BrandKit {
  return resolveBrandKit(parseBrandKitUnchecked(raw));
}

export function stringifyBrandKit(kit: BrandKit): string {
  return JSON.stringify(kit);
}

export function brandLabel(kit: BrandKit) {
  const host = (kit.website || "")
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .trim();
  if (host && !/^example\./i.test(host) && host !== "localhost") return host;
  const offer = kit.offer.trim().split(/[.!]/)[0]?.trim() || "";
  if (offer && offer.length <= 48) return offer;
  return "Studio";
}

export function brandKitBrief(kit: BrandKit): string {
  const samples = kit.samplePosts.filter(Boolean).join("\n- ");
  const banned = kit.forbiddenWords.filter(Boolean).join(", ");
  return [
    `Voice: ${kit.voice || "(not set)"}`,
    `Audience: ${kit.audience || "(not set)"}`,
    `Offer: ${kit.offer || "(not set)"}`,
    `Website: ${kit.website || "(not set)"}`,
    samples ? `Sample posts:\n- ${samples}` : "Sample posts: (none)",
    banned ? `Forbidden words: ${banned}` : "Forbidden words: (none)",
  ].join("\n");
}
