/**
 * AI Photo Studio presets — pure, client-safe data (no server imports).
 *
 * Every preset runs through the real native image pipeline:
 * - "edit" mode sends `editPrompt` verbatim as the variation prompt
 *   (uploaded photo + instruction → new image) to a variation-capable
 *   provider (OpenAI Image / Gemini Image).
 * - "generate" mode appends `generateSuffix` to the user's own prompt
 *   for a fresh text-to-image generation.
 * There are no fake presets: if a preset is listed here, it executes.
 */

export type PhotoStudioMode = "edit" | "generate";

export type PhotoStudioPreset = {
  id: string;
  label: string;
  blurb: string;
  modes: readonly PhotoStudioMode[];
  /** Instruction sent verbatim as the variation prompt in edit mode. */
  editPrompt: string;
  /** Style suffix appended to the user's prompt in generate mode. */
  generateSuffix: string;
  seasonal?: boolean;
};

export const PHOTO_STUDIO_PRESETS: readonly PhotoStudioPreset[] = [
  {
    id: "professional-headshot",
    label: "Professional headshot",
    blurb: "A clean, LinkedIn-ready studio portrait from any photo.",
    modes: ["edit", "generate"],
    editPrompt:
      "Turn this photo into a polished professional corporate headshot. Keep the person's face, facial features, skin tone and identity exactly the same and fully recognisable. Replace the background with a clean, softly blurred modern office backdrop, add soft professional studio lighting with gentle catchlights in the eyes, tidy the framing to a head-and-shoulders crop, and dress the presentation in smart business attire if clothing is visible. Photorealistic, sharp focus, natural skin texture, no beauty-filter smoothing.",
    generateSuffix:
      ", professional corporate headshot portrait, head-and-shoulders framing, soft studio lighting, clean softly blurred office background, smart business attire, photorealistic, sharp focus, natural skin texture",
  },
  {
    id: "cricket-fan-poster",
    label: "Cricket fan poster",
    blurb: "A stadium-poster look for cricket fans.",
    modes: ["edit", "generate"],
    editPrompt:
      "Transform this photo into an epic cricket fan poster. Keep the person's face and identity exactly the same and fully recognisable. Place them in a packed floodlit cricket stadium at night with dramatic rim lighting, subtle green-and-gold confetti in the air, and a bold cinematic sports-poster grade — deep contrast, rich colour, slight low-angle heroic framing. Photorealistic face, poster-quality finish, no text or logos added.",
    generateSuffix:
      ", epic cricket fan poster in a packed floodlit stadium at night, dramatic rim lighting, green and gold confetti in the air, bold cinematic sports-poster colour grade, heroic low-angle framing, photorealistic, no text",
  },
  {
    id: "vintage-yearbook",
    label: "Vintage yearbook",
    blurb: "A nostalgic 1990s school yearbook portrait.",
    modes: ["edit", "generate"],
    editPrompt:
      "Restyle this photo as a 1990s school yearbook portrait. Keep the person's face, features and identity exactly the same and fully recognisable. Use the classic yearbook look: mottled blue-grey studio backdrop, soft frontal flash lighting, slightly faded film colours, gentle film grain, and period-appropriate neat styling. Head-and-shoulders framing, warm nostalgic print finish, photorealistic face.",
    generateSuffix:
      ", 1990s school yearbook portrait, mottled blue-grey studio backdrop, soft frontal flash, faded film colours, gentle film grain, head-and-shoulders framing, nostalgic print finish, photorealistic",
  },
  {
    id: "cartoon-style",
    label: "Cartoon style",
    blurb: "A bright animated-cartoon version of the photo.",
    modes: ["edit", "generate"],
    editPrompt:
      "Redraw this photo as a bright, polished 3D animated-film cartoon. Keep the same person clearly recognisable — same face shape, hairstyle, skin tone, expression and pose — but render them in a friendly Pixar-style 3D cartoon look with smooth shading, big expressive eyes kept natural in proportion, and vivid saturated colours. Keep the same scene and composition, simplified into clean cartoon shapes. No text.",
    generateSuffix:
      ", bright polished 3D animated-film cartoon style, friendly Pixar-like rendering, smooth shading, vivid saturated colours, clean shapes, expressive and cheerful, no text",
  },
  {
    id: "eid-card",
    label: "Eid greeting card",
    blurb: "A festive Eid card design, ready to share.",
    modes: ["edit", "generate"],
    seasonal: true,
    editPrompt:
      "Turn this photo into an elegant Eid greeting card design. Keep the person's face and identity exactly the same and fully recognisable. Frame the portrait inside a refined festive composition: deep emerald and gold palette, a delicate crescent moon and stars, subtle Islamic geometric border patterns, and warm celebratory lighting. Leave clean empty space at the top for a greeting to be added later. Do not render any text or lettering. Premium, tasteful, photorealistic portrait.",
    generateSuffix:
      ", elegant Eid greeting card design, deep emerald and gold palette, crescent moon and stars, subtle Islamic geometric border, warm celebratory lighting, clean empty space at the top for a greeting, premium and tasteful, no text or lettering",
  },
  {
    id: "psl-fan-pack",
    label: "PSL fan poster",
    blurb: "A Pakistan Super League match-day fan poster.",
    modes: ["edit", "generate"],
    seasonal: true,
    editPrompt:
      "Transform this photo into a Pakistan Super League match-day fan poster. Keep the person's face and identity exactly the same and fully recognisable. Put them in a roaring night stadium under floodlights wearing energetic fan energy — face paint in green is welcome if it suits the photo — with floodlit haze, falling confetti, and a bold teal-and-green cinematic sports grade. Heroic poster framing, photorealistic face, no text, no team logos.",
    generateSuffix:
      ", Pakistan Super League match-day fan poster, roaring night stadium under floodlights, falling confetti, bold teal and green cinematic sports grade, heroic poster framing, photorealistic, no text, no logos",
  },
  {
    id: "restore-colorize",
    label: "Restore & colorize",
    blurb: "Repair an old or damaged photo and bring it to colour.",
    modes: ["edit"],
    editPrompt:
      "Restore this old or damaged photo: repair scratches, tears, dust spots, stains and fading, recover lost contrast and sharpness, and remove noise and compression artefacts. If the photo is black and white or sepia, colorize it naturally with realistic skin tones and period-appropriate colours. Keep every face, person and detail identical to the original — do not change facial features, expressions, clothing shapes or the composition. The result should look like a clean, well-preserved modern scan of the same photograph.",
    generateSuffix: "",
  },
];

export function getPhotoStudioPreset(id: string): PhotoStudioPreset | null {
  return PHOTO_STUDIO_PRESETS.find((preset) => preset.id === id) ?? null;
}

/**
 * A named group of presets as rendered by the studios. The built-in code
 * presets form the always-on "core" pack; seasonal packs are admin-curated
 * rows (StudioPresetPack) resolved server-side in
 * src/lib/studio-preset-packs.ts and passed down in this shape.
 */
export type StudioPresetPackData = {
  slug: string;
  name: string;
  description: string;
  /** Seasonal packs render with a "Seasonal" treatment and a heading. */
  seasonal: boolean;
  presets: PhotoStudioPreset[];
};

export const CORE_STUDIO_PACK_SLUG = "core";

/**
 * Merge admin-curated seasonal packs with the built-in default pack.
 * A curated preset shadows a built-in with the same id, so once the owner
 * seeds/activates a seasonal pack (e.g. Eid, PSL) its data — not the code
 * constant — is what renders, inside its date window only. Built-ins that
 * are not shadowed always render, so nothing regresses when no seasonal
 * pack exists.
 */
export function resolveStudioPresetPacks(
  curated: readonly StudioPresetPackData[],
): StudioPresetPackData[] {
  const shadowed = new Set(
    curated.flatMap((pack) => pack.presets.map((preset) => preset.id)),
  );
  const fallback = PHOTO_STUDIO_PRESETS.filter(
    (preset) => !shadowed.has(preset.id),
  );
  const packs: StudioPresetPackData[] = [];
  if (fallback.length > 0) {
    packs.push({
      slug: CORE_STUDIO_PACK_SLUG,
      name: "Everyday styles",
      description: "",
      seasonal: false,
      presets: [...fallback],
    });
  }
  packs.push(...curated);
  return packs;
}

export function photoStudioPresetsForMode(
  mode: PhotoStudioMode,
): PhotoStudioPreset[] {
  return PHOTO_STUDIO_PRESETS.filter((preset) => preset.modes.includes(mode));
}
