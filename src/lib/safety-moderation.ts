/**
 * Safety moderation for chat (owner directive, 2026-11-25).
 *
 * Every incoming user chat message is classified HERE, on the server,
 * BEFORE it is sent to any model. A flagged message never reaches the
 * model: the caller returns the refusal copy from `safetyRefusal()` and
 * writes a SafetyAlert row (see src/lib/safety-alerts.ts) so the attempt
 * shows up in the admin panel like an alarm.
 *
 * This is a self-contained rules engine on purpose: the platform's
 * provider API keys are not configured yet, so nothing here may call an
 * external API. It covers English plus Roman Urdu / Urdu script, because
 * most of the user base writes one of those.
 *
 * FUTURE INTEGRATION POINT: when provider keys land, a provider
 * moderation API (e.g. OpenAI `omni-moderation`) can be called from
 * `classifySafety`'s callers and merged with this verdict — take the
 * higher score and the union of categories. Keep this rules engine as
 * the offline floor: it must keep working with zero keys configured.
 *
 * Design notes:
 * - Scores are additive per category; `flagged` starts at FLAG_THRESHOLD.
 * - A harmful *object* alone ("what is a bomb?") scores low — the engine
 *   looks for instruction-seeking intent, first-person intent, or an
 *   explicit harmful phrase before it blocks.
 * - Informational framing (news / essay / history / film) caps the score
 *   below the threshold unless explicit instruction-seeking is present.
 * - Self-harm is flagged too, but its refusal copy is a supportive
 *   crisis response, not a scolding.
 */

export const SAFETY_CATEGORIES = [
  "violence_harm",
  "weapons_explosives",
  "poisoning_substances",
  "arson_destruction",
  "self_harm",
  "csam",
] as const;

export type SafetyCategory = (typeof SAFETY_CATEGORIES)[number];

export const SAFETY_CATEGORY_LABELS: Record<SafetyCategory, string> = {
  violence_harm: "Violence / harm to others",
  weapons_explosives: "Weapons / explosives",
  poisoning_substances: "Poisoning / dangerous substances",
  arson_destruction: "Arson / property destruction",
  self_harm: "Self-harm",
  csam: "Sexual content involving minors",
};

export type SafetySeverity = "medium" | "high" | "critical";

export type SafetyVerdict = {
  flagged: boolean;
  category: SafetyCategory | null;
  severity: SafetySeverity | null;
  /** 0–100. Highest category score wins. */
  score: number;
  /** Human-readable rule labels that fired, for the admin alert. */
  matchedSignals: string[];
};

export const SAFETY_FLAG_THRESHOLD = 55;

const CATEGORY_SEVERITY: Record<SafetyCategory, SafetySeverity> = {
  violence_harm: "high",
  weapons_explosives: "high",
  poisoning_substances: "high",
  arson_destruction: "medium",
  self_harm: "high",
  csam: "critical",
};

/* ------------------------------------------------------------------ */
/* Normalization                                                       */
/* ------------------------------------------------------------------ */

type Haystack = {
  /** Lowercased, leet-folded, punctuation spaced — for Latin matching. */
  latin: string;
  /** Lowercased original — Urdu-script phrases match against this. */
  raw: string;
};

function buildHaystack(text: string): Haystack {
  const raw = text.toLowerCase().replace(/\s+/g, " ").trim();
  const latin = raw
    // Leet folding so "b0mb" / "p01son" still match plain patterns.
    .replace(/[0-9]/g, (digit) => {
      switch (digit) {
        case "0":
          return "o";
        case "1":
          return "i";
        case "3":
          return "e";
        case "4":
          return "a";
        case "5":
          return "s";
        case "7":
          return "t";
        case "8":
          return "b";
        default:
          return digit;
      }
    })
    // Keep Latin letters, digits and the Arabic-script block (Urdu);
    // everything else becomes a word separator.
    .replace(/[^a-z0-9؀-ۿ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return { latin: ` ${latin} `, raw };
}

/** Word-boundary regex from a plain phrase (Latin haystack only). */
function phrase(pattern: string): RegExp {
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^| )${escaped}( |$)`);
}

function has(hay: Haystack, pattern: string): boolean {
  return phrase(pattern).test(hay.latin);
}

function hasAny(hay: Haystack, patterns: string[]): boolean {
  return patterns.some((pattern) => has(hay, pattern));
}

function hasRaw(hay: Haystack, needle: string): boolean {
  return hay.raw.includes(needle);
}

/* ------------------------------------------------------------------ */
/* Shared signal groups                                                */
/* ------------------------------------------------------------------ */

/** Instruction-seeking intent: "how to", "tarika", "batao", … */
const INTENT_PATTERNS: (RegExp | string)[] = [
  /\bhow (to|do i|can i|would i)\b/,
  /\bsteps? (to|for)\b/,
  /\binstructions? (to|for)\b/,
  /\brecipe for\b/,
  /\bteach me\b/,
  /\btell me how\b/,
  /\bways? to\b/,
  /\bguide (to|for)\b/,
  "kaise",
  "kaisay",
  "tarika",
  "tareeka",
  "tariqa",
  "batao",
  "bata do",
  "sikhao",
  "banana hai",
  "banane ka",
  "banani hai",
  "karna hai",
  "karne ka tarika",
  "karne ka tareeka",
];

function hasIntent(hay: Haystack): boolean {
  return (
    INTENT_PATTERNS.some((pattern) =>
      typeof pattern === "string" ? has(hay, pattern) : pattern.test(hay.latin),
    ) ||
    hasRaw(hay, "کیسے") ||
    hasRaw(hay, "طریقہ") ||
    hasRaw(hay, "بتاؤ") ||
    hasRaw(hay, "بنانا ہے")
  );
}

/** First-person desire/intent: "i want to", "mujhe … chahiye", "chahta hoon". */
function hasFirstPersonIntent(hay: Haystack): boolean {
  return (
    /\b(i|we) (want|need|will|am going) to\b/.test(hay.latin) ||
    /\bi want\b/.test(hay.latin) ||
    hasAny(hay, [
      "mujhe",
      "mujhay",
      "chahta hoon",
      "chahti hoon",
      "chahiye",
      "karunga",
      "kar dunga",
      "kar doonga",
    ]) ||
    hasRaw(hay, "چاہتا ہوں") ||
    hasRaw(hay, "مجھے")
  );
}

/** Informational / fictional framing that should not, by itself, block. */
function hasInformationalFraming(hay: Haystack): boolean {
  return (
    hasAny(hay, [
      "news",
      "essay",
      "article",
      "history of",
      "documentary",
      "movie",
      "film",
      "novel",
      "story about",
      "research paper",
      "awareness",
      "prevention",
      "mazmoon",
      "khabar",
      "kahani",
      "mukammal maloomat",
    ]) ||
    hasRaw(hay, "خبر") ||
    hasRaw(hay, "مضمون")
  );
}

/** Everyday idioms that must never flag on their own. */
const BENIGN_IDIOMS = [
  "kill time",
  "killing time",
  "kill the lights",
  "kill the process",
  "killing it",
  "bombed the exam",
  "bombed my exam",
  "bombed the test",
  "da bomb",
];

/* ------------------------------------------------------------------ */
/* Per-category scoring                                                */
/* ------------------------------------------------------------------ */

type CategoryScore = { score: number; signals: string[] };

function scoreCsam(hay: Haystack): CategoryScore {
  const signals: string[] = [];
  const minor =
    /\b(child|children|kid|kids|minor|minors|underage|preteen|schoolgirl|schoolboy|school girl|school boy|loli|shota)\b/.test(
      hay.latin,
    ) ||
    hasAny(hay, ["bacha", "bachi", "bache", "bachay", "bachon", "nabaligh"]) ||
    hasRaw(hay, "بچے") ||
    hasRaw(hay, "بچی") ||
    hasRaw(hay, "نابالغ");
  const teen = /\b(teen|teenager|teens)\b/.test(hay.latin);
  const sexual =
    /\b(sex|sexual|porn|pornography|nude|nudes|naked|rape|molest|blowjob|handjob|erotic|xxx)\b/.test(
      hay.latin,
    ) ||
    hasAny(hay, ["chudai", "sexy", "nangi", "nanga", "jinsi"]) ||
    hasRaw(hay, "جنسی");
  if ((minor || teen) && sexual) {
    signals.push("minor + sexual content");
    return { score: 100, signals };
  }
  if (hasAny(hay, ["child porn", "child pornography", "cp links", "underage sex"])) {
    signals.push("explicit CSAM phrase");
    return { score: 100, signals };
  }
  return { score: 0, signals };
}

const WEAPON_OBJECTS = [
  "bomb",
  "explosive",
  "explosives",
  "dynamite",
  "grenade",
  "detonator",
  "tnt",
  "molotov",
  "firearm",
  "firearms",
  "silencer",
  "barood",
  "hathyar",
  "asla",
  "bandooq",
  "banduk",
];

function scoreWeapons(hay: Haystack): CategoryScore {
  const signals: string[] = [];
  let score = 0;
  const strong = [
    "pipe bomb",
    "make a bomb",
    "build a bomb",
    "homemade bomb",
    "bomb banana",
    "bomb banane",
    "bomb bana",
    "bomb kaise",
    "bomb blast karna",
    "barood banana",
    "barood bana",
    "make explosives",
    "build explosives",
    "make a grenade",
    "detonator banana",
    "dhamaka karna",
    "dhamaka karne",
    "ghost gun",
    "print a gun",
    "printing a gun",
    "gun banana",
    "gun banane",
    "hathyar banana",
    "hathyar banane",
    "molotov banana",
    "molotov cocktail banana",
  ];
  for (const pattern of strong) {
    if (has(hay, pattern)) {
      score = Math.max(score, 92);
      signals.push(`weapons phrase: ${pattern}`);
    }
  }
  if (
    hasRaw(hay, "بم بنانا") ||
    hasRaw(hay, "بم بنانے") ||
    hasRaw(hay, "بارود") ||
    hasRaw(hay, "ہتھیار بنانا")
  ) {
    score = Math.max(score, 92);
    signals.push("weapons phrase (Urdu script)");
  }
  // Slang: "bomb website / design / logo" means *excellent*, not a weapon.
  // The cap at the end of this function uses this; specific weapon phrases
  // (pipe bomb, barood banana, …) still flag even next to a creative noun.
  const slangBomb =
    /\bbomb (website|design|logo|video|reel|photo|poster|banner|look|party|event|outfit|sale)\b/.test(
      hay.latin,
    );
  const object = WEAPON_OBJECTS.find((word) => has(hay, word));
  if (object) {
    if (hasIntent(hay)) {
      score = Math.max(score, 72);
      signals.push(`instruction intent + weapon object: ${object}`);
    } else {
      score = Math.max(score, 22);
      signals.push(`weapon object mentioned: ${object}`);
    }
  }
  // Slang cap, applied last: when "bomb" is clearly the *excellent* slang
  // ("make a bomb website design for my brand") and the only strong hits
  // were the generic make/build-a-bomb phrases, this is a design request.
  if (slangBomb) {
    const specificHit = signals.some(
      (signal) =>
        signal.startsWith("weapons phrase:") &&
        !signal.includes("make a bomb") &&
        !signal.includes("build a bomb"),
    );
    if (!specificHit) score = Math.min(score, 25);
  }
  return { score, signals };
}

function scorePoisoning(hay: Haystack): CategoryScore {
  const signals: string[] = [];
  let score = 0;
  const strong = [
    "poison someone",
    "poison him",
    "poison her",
    "poison them",
    "make poison",
    "make a poison",
    "poison banana",
    "poison banane",
    "zehar dena",
    "zehar de",
    "zehar milana",
    "zehar mila",
    "zehar banana",
    "zehar banane",
    "zehar kaise",
    "khane mein zehar",
    "khanay mein zehar",
    "chai mein zehar",
    "lethal dose",
    "kitna zehar",
    "undetectable poison",
    "poison jo pata na chale",
    "zehar jo pata na chale",
    "make meth",
    "meth banana",
    "meth banane",
  ];
  for (const pattern of strong) {
    if (has(hay, pattern)) {
      score = Math.max(score, 90);
      signals.push(`poisoning phrase: ${pattern}`);
    }
  }
  if (hasRaw(hay, "زہر دینا") || hasRaw(hay, "زہر بنانا") || hasRaw(hay, "زہر ملا")) {
    score = Math.max(score, 90);
    signals.push("poisoning phrase (Urdu script)");
  }
  const object = ["poison", "zehar", "zahar", "arsenic", "cyanide", "ricin"].find(
    (word) => has(hay, word),
  );
  if (object) {
    if (hasIntent(hay) || hasFirstPersonIntent(hay)) {
      score = Math.max(score, 70);
      signals.push(`intent + poison object: ${object}`);
    } else {
      score = Math.max(score, 20);
      signals.push(`poison object mentioned: ${object}`);
    }
  }
  return { score, signals };
}

function scoreViolence(hay: Haystack): CategoryScore {
  const signals: string[] = [];
  let score = 0;
  // Tech idiom: "kill a process / port / app" is not violence.
  if (
    /\bkill (a |the )?(process|app|application|port|server|task|program|session|command|terminal|container|job)\b/.test(
      hay.latin,
    )
  ) {
    return { score: 0, signals };
  }
  const strong = [
    "kill someone",
    "kill him",
    "kill her",
    "kill them",
    "murder someone",
    "murder him",
    "murder her",
    "maar dalna",
    "maar daalna",
    "maar dalo",
    "qatal karna",
    "qatal karne",
    "katal karna",
    "jaan se marna",
    "jaan se maar",
    "jaan lena uski",
    "gala kaat",
    "sar kaat",
    "chaku marna",
    "chaaku marna",
    "kidnap karna",
    "kidnap karne",
    "aghwa karna",
    "agwa karna",
    "rape karna",
    "rape someone",
    "kisi ko marna",
    "kisi ko maar",
    "kisi ko nuqsan",
    "kisi ko nuksan",
    "usko marna",
    "usko maar",
    "isko marna",
    "hurt someone badly",
    "beat him up",
    "beat her up",
  ];
  for (const pattern of strong) {
    if (has(hay, pattern)) {
      score = Math.max(score, 88);
      signals.push(`violence phrase: ${pattern}`);
    }
  }
  if (
    hasRaw(hay, "قتل کرنا") ||
    hasRaw(hay, "مار ڈالنا") ||
    hasRaw(hay, "کسی کو نقصان") ||
    hasRaw(hay, "اغوا کرنا")
  ) {
    score = Math.max(score, 88);
    signals.push("violence phrase (Urdu script)");
  }
  const verb = ["kill", "murder", "stab", "shoot", "marna", "maarna"].find((word) =>
    has(hay, word),
  );
  const target = [
    "someone",
    "somebody",
    "person",
    "him",
    "her",
    "them",
    "kisi",
    "admi",
    "banda",
    "usko",
    "isko",
    "neighbour",
    "neighbor",
    "padosi",
  ].find((word) => has(hay, word));
  if (verb && target && (hasIntent(hay) || hasFirstPersonIntent(hay))) {
    score = Math.max(score, 68);
    signals.push(`intent + harm verb (${verb}) + target (${target})`);
  } else if (verb && hasIntent(hay)) {
    score = Math.max(score, 60);
    signals.push(`instruction intent + harm verb: ${verb}`);
  }
  return { score, signals };
}

function scoreArson(hay: Haystack): CategoryScore {
  const signals: string[] = [];
  let score = 0;
  const strong = [
    "aag lagana",
    "aag lagane",
    "aag kaise lagaye",
    "aag kaise lagain",
    "jala dena",
    "jala do",
    "ghar jalana",
    "ghar jala",
    "gaari jalana",
    "gari jalana",
    "dukan jalana",
    "dukaan jalana",
    "burn down",
    "burn his house",
    "burn her house",
    "burn their house",
    "burn the house",
    "set fire to",
    "set his house on fire",
    "set her house on fire",
    "arson kaise",
  ];
  for (const pattern of strong) {
    if (has(hay, pattern)) {
      score = Math.max(score, 84);
      signals.push(`arson phrase: ${pattern}`);
    }
  }
  if (hasRaw(hay, "آگ لگانا") || hasRaw(hay, "آگ لگانے") || hasRaw(hay, "جلانا ہے")) {
    score = Math.max(score, 84);
    signals.push("arson phrase (Urdu script)");
  }
  const burnVerb = ["burn", "jalana", "jalane", "lagana"].find((word) => has(hay, word));
  const property = [
    "house",
    "car",
    "shop",
    "building",
    "ghar",
    "gaari",
    "gari",
    "dukan",
    "dukaan",
    "makan",
  ].find((word) => has(hay, word));
  if (burnVerb && property && (hasIntent(hay) || hasFirstPersonIntent(hay))) {
    score = Math.max(score, 64);
    signals.push(`intent + burn verb (${burnVerb}) + property (${property})`);
  }
  return { score, signals };
}

function scoreSelfHarm(hay: Haystack): CategoryScore {
  const signals: string[] = [];
  let score = 0;
  const firstPerson = [
    "kill myself",
    "end my life",
    "take my own life",
    "hurt myself",
    "harm myself",
    "cut myself",
    "hang myself",
    "want to die",
    "i want to die",
    "no reason to live",
    "better off dead",
    "khudkushi karna",
    "khudkushi karne",
    "khud kushi karna",
    "khud ko marna",
    "apni jaan lena",
    "apni jaan lene",
    "mar jana chahta",
    "mar jana chahti",
    "jeena nahi chahta",
    "jeena nahi chahti",
    "zindagi khatam karna",
    "apne aap ko nuqsan",
    "apne aap ko nuksan",
  ];
  for (const pattern of firstPerson) {
    if (has(hay, pattern)) {
      score = Math.max(score, 95);
      signals.push(`self-harm first-person phrase: ${pattern}`);
    }
  }
  if (
    hasRaw(hay, "خودکشی") ||
    hasRaw(hay, "اپنی جان لینا") ||
    hasRaw(hay, "مرنا چاہتا") ||
    hasRaw(hay, "مرنا چاہتی")
  ) {
    score = Math.max(score, 95);
    signals.push("self-harm phrase (Urdu script)");
  }
  // Method-seeking about suicide, even without first-person phrasing.
  if (
    (has(hay, "suicide") || has(hay, "khudkushi") || has(hay, "khud kushi")) &&
    (hasIntent(hay) || hasAny(hay, ["methods", "method", "tarike", "tareeqay"]))
  ) {
    score = Math.max(score, 90);
    signals.push("suicide method-seeking");
  } else if (has(hay, "suicidal") && hasFirstPersonIntent(hay)) {
    score = Math.max(score, 80);
    signals.push("suicidal + first-person intent");
  } else if (has(hay, "suicide") || has(hay, "khudkushi")) {
    // Bare mention (news, awareness, a friend's situation) stays low.
    score = Math.max(score, 25);
    signals.push("suicide mentioned without intent");
  }
  return { score, signals };
}

/* ------------------------------------------------------------------ */
/* Public classifier                                                   */
/* ------------------------------------------------------------------ */

export function classifySafety(text: string): SafetyVerdict {
  const clean = (text ?? "").trim();
  if (!clean) {
    return { flagged: false, category: null, severity: null, score: 0, matchedSignals: [] };
  }
  const hay = buildHaystack(clean);

  const scored: [SafetyCategory, CategoryScore][] = [
    ["csam", scoreCsam(hay)],
    ["weapons_explosives", scoreWeapons(hay)],
    ["poisoning_substances", scorePoisoning(hay)],
    ["violence_harm", scoreViolence(hay)],
    ["arson_destruction", scoreArson(hay)],
    ["self_harm", scoreSelfHarm(hay)],
  ];

  let best: SafetyCategory = scored[0][0];
  let bestScore = -1;
  const signals: string[] = [];
  for (const [category, result] of scored) {
    if (result.score > bestScore) {
      bestScore = result.score;
      best = category;
    }
    for (const signal of result.signals) signals.push(`${category}: ${signal}`);
  }

  // Everyday idioms never flag unless a strong category phrase also fired.
  if (bestScore < 80 && BENIGN_IDIOMS.some((idiom) => has(hay, idiom))) {
    bestScore = Math.min(bestScore, 15);
  }

  // Informational framing (news / essay / history / film) caps the score
  // below the threshold — unless the message still asks for instructions.
  if (bestScore < 90 && hasInformationalFraming(hay) && !hasIntent(hay)) {
    bestScore = Math.min(bestScore, 40);
  }

  const flagged = bestScore >= SAFETY_FLAG_THRESHOLD;
  return {
    flagged,
    category: flagged ? best : null,
    severity: flagged ? CATEGORY_SEVERITY[best] : null,
    score: Math.max(0, Math.min(100, bestScore)),
    matchedSignals: flagged ? signals : [],
  };
}

/* ------------------------------------------------------------------ */
/* Refusal copy                                                        */
/* ------------------------------------------------------------------ */

export type SafetyLanguage = "en" | "ur-roman" | "ur-script";

/**
 * Reply language for a refused message: Urdu script when the user wrote
 * Urdu script, Roman Urdu when they wrote Roman Urdu, English otherwise.
 * Never Hindi.
 */
export function detectSafetyLanguage(text: string): SafetyLanguage {
  if (/[؀-ۿ]/.test(text)) return "ur-script";
  const hay = buildHaystack(text);
  const romanMarkers = [
    "mujhe",
    "mujhay",
    "kaise",
    "kaisay",
    "hai",
    "hain",
    "kya",
    "karna",
    "karne",
    "batao",
    "chahiye",
    "nahi",
    "nahin",
    "mera",
    "meri",
    "usko",
    "isko",
    "wala",
    "wali",
    "main",
    "mein",
    "hoon",
    "chahta",
    "chahti",
    "koi",
    "kuch",
    "apni",
    "apne",
    "jaan",
    "bohat",
  ];
  const hits = romanMarkers.filter((word) => has(hay, word)).length;
  return hits >= 2 ? "ur-roman" : "en";
}

const REFUSALS: Record<
  SafetyLanguage,
  { standard: string; selfHarm: string; csam: string }
> = {
  en: {
    standard:
      "I can't help with that. This request could seriously harm someone, so I won't provide instructions or advice for it. If you're in a difficult situation, please consider talking to someone you trust or a professional who can help.",
    selfHarm:
      "I'm really sorry you're feeling this way — you don't have to face it alone. Please reach out right now to someone you trust, or call your local emergency number or a crisis helpline in your country. I can't provide methods or instructions for harming yourself, but your life matters and support is available.",
    csam:
      "I can't help with that. Sexual content involving minors is illegal and strictly prohibited here.",
  },
  "ur-roman": {
    standard:
      "Main is mein madad nahi kar sakta. Is request se kisi ko shadeed nuqsan pohanch sakta hai, is liye main is ke liye koi instructions ya mashwara nahi dunga. Agar aap kisi mushkil surat-e-haal mein hain to meherbani karke kisi bharosay walay shakhs ya kisi professional se baat karein jo aap ki madad kar sakay.",
    selfHarm:
      "Mujhe ye jaan kar bohat afsos hua — aap ko ye akelay nahi sehna chahiye. Meherbani karke abhi kisi bharosay walay shakhs se baat karein, ya apne mulk ke emergency number ya crisis helpline par call karein. Main khud ko nuqsan pohanchane ke tareeqay nahi bata sakta, lekin aap ki zindagi qeemti hai aur madad mojood hai.",
    csam:
      "Main is mein bilkul madad nahi kar sakta. Bachon se mutaliq jinsi content ghair qanooni hai aur yahan sakhti se mana hai.",
  },
  "ur-script": {
    standard:
      "میں اس میں مدد نہیں کر سکتا۔ اس درخواست سے کسی کو شدید نقصان پہنچ سکتا ہے، اس لیے میں اس کے لیے کوئی ہدایات یا مشورہ نہیں دوں گا۔ اگر آپ کسی مشکل صورتحال میں ہیں تو براہ کرم کسی بھروسے والے شخص یا کسی پیشہ ور سے بات کریں جو آپ کی مدد کر سکے۔",
    selfHarm:
      "مجھے یہ جان کر بہت افسوس ہوا — آپ کو یہ اکیلے نہیں سہنا چاہیے۔ براہ کرم ابھی کسی بھروسے والے شخص سے بات کریں، یا اپنے ملک کے ایمرجنسی نمبر یا کرائسس ہیلپ لائن پر کال کریں۔ میں خود کو نقصان پہنچانے کے طریقے نہیں بتا سکتا، لیکن آپ کی زندگی قیمتی ہے اور مدد موجود ہے۔",
    csam:
      "میں اس میں بالکل مدد نہیں کر سکتا۔ بچوں سے متعلق جنسی مواد غیر قانونی ہے اور یہاں سختی سے منع ہے۔",
  },
};

/** The reply shown instead of a model answer for a flagged message. */
export function safetyRefusal(category: SafetyCategory | null, userText: string): string {
  const copy = REFUSALS[detectSafetyLanguage(userText)];
  if (category === "self_harm") return copy.selfHarm;
  if (category === "csam") return copy.csam;
  return copy.standard;
}
