/**
 * Official Deepgram Aura / Aura-2 TTS voice catalog.
 * Source: https://developers.deepgram.com/docs/tts-models (2026-09).
 * Runtime may merge additional voices from GET /v1/models when a key is set.
 */
export type DeepgramVoiceArchitecture = "aura" | "aura-2";

export interface DeepgramVoiceEntry {
  /** API model id, e.g. aura-2-thalia-en */
  modelId: string;
  /** Human label, e.g. Thalia */
  displayName: string;
  /** Expressed gender from Deepgram docs */
  gender: "feminine" | "masculine";
  /** Short style / characteristic label */
  style: string;
  /** BCP-47-ish locale from docs (en-us, es-mx, …) */
  locale: string;
  /** ISO language code for STT hint (en, es, de, …) */
  language: string;
  architecture: DeepgramVoiceArchitecture;
}

const DEFAULT_VOICE_ID = "aura-2-thalia-en";

/** Compact rows: modelId, displayName, gender, locale, language, architecture, style */
const RAW: Array<
  [string, string, DeepgramVoiceEntry["gender"], string, string, DeepgramVoiceArchitecture, string]
> = [
  // Aura-2 English
  ["aura-2-amalthea-en", "Amalthea", "feminine", "en-ph", "en", "aura-2", "Cheerful · Filipino"],
  ["aura-2-andromeda-en", "Andromeda", "feminine", "en-us", "en", "aura-2", "Expressive · Casual"],
  ["aura-2-apollo-en", "Apollo", "masculine", "en-us", "en", "aura-2", "Confident · Casual"],
  ["aura-2-arcas-en", "Arcas", "masculine", "en-us", "en", "aura-2", "Smooth · Natural"],
  ["aura-2-aries-en", "Aries", "masculine", "en-us", "en", "aura-2", "Warm · Energetic"],
  ["aura-2-asteria-en", "Asteria", "feminine", "en-us", "en", "aura-2", "Clear · Confident"],
  ["aura-2-athena-en", "Athena", "feminine", "en-us", "en", "aura-2", "Calm · Professional"],
  ["aura-2-atlas-en", "Atlas", "masculine", "en-us", "en", "aura-2", "Friendly · Enthusiastic"],
  ["aura-2-aurora-en", "Aurora", "feminine", "en-us", "en", "aura-2", "Cheerful · Energetic"],
  ["aura-2-callista-en", "Callista", "feminine", "en-us", "en", "aura-2", "Clear · Professional"],
  ["aura-2-cora-en", "Cora", "feminine", "en-us", "en", "aura-2", "Smooth · Caring"],
  ["aura-2-cordelia-en", "Cordelia", "feminine", "en-us", "en", "aura-2", "Warm · Polite"],
  ["aura-2-delia-en", "Delia", "feminine", "en-us", "en", "aura-2", "Friendly · Cheerful"],
  ["aura-2-draco-en", "Draco", "masculine", "en-gb", "en", "aura-2", "Warm · British"],
  ["aura-2-electra-en", "Electra", "feminine", "en-us", "en", "aura-2", "Professional · Engaging"],
  ["aura-2-harmonia-en", "Harmonia", "feminine", "en-us", "en", "aura-2", "Empathetic · Calm"],
  ["aura-2-helena-en", "Helena", "feminine", "en-us", "en", "aura-2", "Caring · Friendly"],
  ["aura-2-hera-en", "Hera", "feminine", "en-us", "en", "aura-2", "Smooth · Professional"],
  ["aura-2-hermes-en", "Hermes", "masculine", "en-us", "en", "aura-2", "Expressive · Professional"],
  ["aura-2-hyperion-en", "Hyperion", "masculine", "en-au", "en", "aura-2", "Warm · Empathetic"],
  ["aura-2-iris-en", "Iris", "feminine", "en-us", "en", "aura-2", "Cheerful · Approachable"],
  ["aura-2-janus-en", "Janus", "feminine", "en-us", "en", "aura-2", "Southern · Trustworthy"],
  ["aura-2-juno-en", "Juno", "feminine", "en-us", "en", "aura-2", "Natural · Melodic"],
  ["aura-2-jupiter-en", "Jupiter", "masculine", "en-us", "en", "aura-2", "Knowledgeable · Baritone"],
  ["aura-2-luna-en", "Luna", "feminine", "en-us", "en", "aura-2", "Friendly · Natural"],
  ["aura-2-mars-en", "Mars", "masculine", "en-us", "en", "aura-2", "Smooth · Trustworthy"],
  ["aura-2-minerva-en", "Minerva", "feminine", "en-us", "en", "aura-2", "Positive · Friendly"],
  ["aura-2-neptune-en", "Neptune", "masculine", "en-us", "en", "aura-2", "Professional · Patient"],
  ["aura-2-odysseus-en", "Odysseus", "masculine", "en-us", "en", "aura-2", "Calm · Professional"],
  ["aura-2-ophelia-en", "Ophelia", "feminine", "en-us", "en", "aura-2", "Enthusiastic · Cheerful"],
  ["aura-2-orion-en", "Orion", "masculine", "en-us", "en", "aura-2", "Calm · Polite"],
  ["aura-2-orpheus-en", "Orpheus", "masculine", "en-us", "en", "aura-2", "Confident · Trustworthy"],
  ["aura-2-pandora-en", "Pandora", "feminine", "en-gb", "en", "aura-2", "Smooth · British"],
  ["aura-2-phoebe-en", "Phoebe", "feminine", "en-us", "en", "aura-2", "Energetic · Warm"],
  ["aura-2-pluto-en", "Pluto", "masculine", "en-us", "en", "aura-2", "Calm · Empathetic"],
  ["aura-2-saturn-en", "Saturn", "masculine", "en-us", "en", "aura-2", "Confident · Baritone"],
  ["aura-2-selene-en", "Selene", "feminine", "en-us", "en", "aura-2", "Expressive · Energetic"],
  ["aura-2-thalia-en", "Thalia", "feminine", "en-us", "en", "aura-2", "Clear · Energetic"],
  ["aura-2-theia-en", "Theia", "feminine", "en-au", "en", "aura-2", "Expressive · Australian"],
  ["aura-2-vesta-en", "Vesta", "feminine", "en-us", "en", "aura-2", "Patient · Empathetic"],
  ["aura-2-zeus-en", "Zeus", "masculine", "en-us", "en", "aura-2", "Deep · Trustworthy"],
  // Aura-2 Spanish
  ["aura-2-sirio-es", "Sirio", "masculine", "es-mx", "es", "aura-2", "Calm · Mexican"],
  ["aura-2-nestor-es", "Nestor", "masculine", "es-es", "es", "aura-2", "Professional · Peninsular"],
  ["aura-2-carina-es", "Carina", "feminine", "es-es", "es", "aura-2", "Energetic · Peninsular"],
  ["aura-2-celeste-es", "Celeste", "feminine", "es-co", "es", "aura-2", "Friendly · Colombian"],
  ["aura-2-alvaro-es", "Alvaro", "masculine", "es-es", "es", "aura-2", "Knowledgeable · Peninsular"],
  ["aura-2-diana-es", "Diana", "feminine", "es-es", "es", "aura-2", "Confident · Peninsular"],
  ["aura-2-aquila-es", "Aquila", "masculine", "es-419", "es", "aura-2", "Enthusiastic · Latin American"],
  ["aura-2-selena-es", "Selena", "feminine", "es-419", "es", "aura-2", "Friendly · Latin American"],
  ["aura-2-estrella-es", "Estrella", "feminine", "es-mx", "es", "aura-2", "Natural · Mexican"],
  ["aura-2-javier-es", "Javier", "masculine", "es-mx", "es", "aura-2", "Professional · Mexican"],
  ["aura-2-agustina-es", "Agustina", "feminine", "es-es", "es", "aura-2", "Clear · Peninsular"],
  ["aura-2-antonia-es", "Antonia", "feminine", "es-ar", "es", "aura-2", "Enthusiastic · Argentine"],
  ["aura-2-gloria-es", "Gloria", "feminine", "es-co", "es", "aura-2", "Expressive · Colombian"],
  ["aura-2-luciano-es", "Luciano", "masculine", "es-mx", "es", "aura-2", "Charismatic · Mexican"],
  ["aura-2-olivia-es", "Olivia", "feminine", "es-mx", "es", "aura-2", "Warm · Mexican"],
  ["aura-2-silvia-es", "Silvia", "feminine", "es-es", "es", "aura-2", "Charismatic · Peninsular"],
  ["aura-2-valerio-es", "Valerio", "masculine", "es-mx", "es", "aura-2", "Professional · Mexican"],
  // Aura-2 Dutch
  ["aura-2-beatrix-nl", "Beatrix", "feminine", "nl-nl", "nl", "aura-2", "Cheerful · Dutch"],
  ["aura-2-daphne-nl", "Daphne", "feminine", "nl-nl", "nl", "aura-2", "Confident · Dutch"],
  ["aura-2-cornelia-nl", "Cornelia", "feminine", "nl-nl", "nl", "aura-2", "Friendly · Dutch"],
  ["aura-2-sander-nl", "Sander", "masculine", "nl-nl", "nl", "aura-2", "Calm · Dutch"],
  ["aura-2-hestia-nl", "Hestia", "feminine", "nl-nl", "nl", "aura-2", "Caring · Dutch"],
  ["aura-2-lars-nl", "Lars", "masculine", "nl-nl", "nl", "aura-2", "Casual · Dutch"],
  ["aura-2-roman-nl", "Roman", "masculine", "nl-nl", "nl", "aura-2", "Patient · Dutch"],
  ["aura-2-rhea-nl", "Rhea", "feminine", "nl-nl", "nl", "aura-2", "Warm · Dutch"],
  ["aura-2-leda-nl", "Leda", "feminine", "nl-nl", "nl", "aura-2", "Empathetic · Dutch"],
  // Aura-2 French
  ["aura-2-agathe-fr", "Agathe", "feminine", "fr-fr", "fr", "aura-2", "Cheerful · French"],
  ["aura-2-hector-fr", "Hector", "masculine", "fr-fr", "fr", "aura-2", "Empathetic · French"],
  // Aura-2 German
  ["aura-2-elara-de", "Elara", "feminine", "de-de", "de", "aura-2", "Calm · German"],
  ["aura-2-aurelia-de", "Aurelia", "feminine", "de-de", "de", "aura-2", "Natural · German"],
  ["aura-2-lara-de", "Lara", "feminine", "de-de", "de", "aura-2", "Warm · German"],
  ["aura-2-julius-de", "Julius", "masculine", "de-de", "de", "aura-2", "Friendly · German"],
  ["aura-2-fabian-de", "Fabian", "masculine", "de-de", "de", "aura-2", "Professional · German"],
  ["aura-2-kara-de", "Kara", "feminine", "de-de", "de", "aura-2", "Caring · German"],
  ["aura-2-viktoria-de", "Viktoria", "feminine", "de-de", "de", "aura-2", "Charismatic · German"],
  // Aura-2 Italian
  ["aura-2-melia-it", "Melia", "feminine", "it-it", "it", "aura-2", "Friendly · Italian"],
  ["aura-2-elio-it", "Elio", "masculine", "it-it", "it", "aura-2", "Calm · Italian"],
  ["aura-2-flavio-it", "Flavio", "masculine", "it-it", "it", "aura-2", "Confident · Italian"],
  ["aura-2-maia-it", "Maia", "feminine", "it-it", "it", "aura-2", "Warm · Italian"],
  ["aura-2-cinzia-it", "Cinzia", "feminine", "it-it", "it", "aura-2", "Approachable · Italian"],
  ["aura-2-cesare-it", "Cesare", "masculine", "it-it", "it", "aura-2", "Knowledgeable · Italian"],
  ["aura-2-livia-it", "Livia", "feminine", "it-it", "it", "aura-2", "Cheerful · Italian"],
  ["aura-2-dionisio-it", "Dionisio", "masculine", "it-it", "it", "aura-2", "Engaging · Italian"],
  ["aura-2-demetra-it", "Demetra", "feminine", "it-it", "it", "aura-2", "Calm · Italian"],
  // Aura-2 Japanese
  ["aura-2-uzume-ja", "Uzume", "feminine", "ja-jp", "ja", "aura-2", "Polite · Japanese"],
  ["aura-2-ebisu-ja", "Ebisu", "masculine", "ja-jp", "ja", "aura-2", "Calm · Japanese"],
  ["aura-2-fujin-ja", "Fujin", "masculine", "ja-jp", "ja", "aura-2", "Professional · Japanese"],
  ["aura-2-izanami-ja", "Izanami", "feminine", "ja-jp", "ja", "aura-2", "Clear · Japanese"],
  ["aura-2-ama-ja", "Ama", "feminine", "ja-jp", "ja", "aura-2", "Natural · Japanese"],
  // Aura 1 English (legacy)
  ["aura-asteria-en", "Asteria", "feminine", "en-us", "en", "aura", "Clear · Confident"],
  ["aura-luna-en", "Luna", "feminine", "en-us", "en", "aura", "Friendly · Natural"],
  ["aura-stella-en", "Stella", "feminine", "en-us", "en", "aura", "Clear · Professional"],
  ["aura-athena-en", "Athena", "feminine", "en-gb", "en", "aura", "Calm · British"],
  ["aura-hera-en", "Hera", "feminine", "en-us", "en", "aura", "Smooth · Professional"],
  ["aura-orion-en", "Orion", "masculine", "en-us", "en", "aura", "Calm · Polite"],
  ["aura-arcas-en", "Arcas", "masculine", "en-us", "en", "aura", "Smooth · Natural"],
  ["aura-perseus-en", "Perseus", "masculine", "en-us", "en", "aura", "Confident · Professional"],
  ["aura-angus-en", "Angus", "masculine", "en-ie", "en", "aura", "Warm · Irish"],
  ["aura-orpheus-en", "Orpheus", "masculine", "en-us", "en", "aura", "Trustworthy · Professional"],
  ["aura-helios-en", "Helios", "masculine", "en-gb", "en", "aura", "Clear · British"],
  ["aura-zeus-en", "Zeus", "masculine", "en-us", "en", "aura", "Deep · Trustworthy"],
];

export const DEEPGRAM_VOICE_CATALOG: DeepgramVoiceEntry[] = RAW.map(
  ([modelId, displayName, gender, locale, language, architecture, style]) => ({
    modelId,
    displayName,
    gender,
    locale,
    language,
    architecture,
    style,
  }),
);

export const DEFAULT_DEEPGRAM_VOICE_ID = DEFAULT_VOICE_ID;

const byId = new Map(DEEPGRAM_VOICE_CATALOG.map((v) => [v.modelId, v]));

export function getDeepgramVoice(modelId?: string | null): DeepgramVoiceEntry | undefined {
  const id = String(modelId || "").trim();
  return id ? byId.get(id) : undefined;
}

export function resolveDeepgramVoiceId(modelId?: string | null): string {
  const id = String(modelId || "").trim();
  if (id && byId.has(id)) return id;
  return DEFAULT_VOICE_ID;
}

/** Language groups for the voice picker filter. */
export const DEEPGRAM_LANGUAGE_FILTERS: { code: string; label: string }[] = [
  { code: "all", label: "All languages" },
  { code: "en", label: "English" },
  { code: "es", label: "Spanish" },
  { code: "de", label: "German" },
  { code: "fr", label: "French" },
  { code: "nl", label: "Dutch" },
  { code: "it", label: "Italian" },
  { code: "ja", label: "Japanese" },
];

export function filterDeepgramVoices(
  voices: DeepgramVoiceEntry[],
  languageCode: string,
  query: string,
): DeepgramVoiceEntry[] {
  const q = query.trim().toLowerCase();
  return voices.filter((v) => {
    if (languageCode !== "all" && v.language !== languageCode) return false;
    if (!q) return true;
    return (
      v.displayName.toLowerCase().includes(q) ||
      v.modelId.toLowerCase().includes(q) ||
      v.style.toLowerCase().includes(q) ||
      v.locale.toLowerCase().includes(q)
    );
  });
}
