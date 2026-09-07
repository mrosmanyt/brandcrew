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

export const DEMO_BRAND_KIT: BrandKit = {
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

export function parseBrandKit(raw: string | null | undefined): BrandKit {
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
