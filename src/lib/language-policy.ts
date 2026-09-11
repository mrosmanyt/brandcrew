/**
 * Global identity + language + scope rules for desk Q&A and agent jobs.
 * Stored agent instructions may still prefer a niche; this layer overrides
 * English-only / hospitality-only refusals, unsolicited sales closers, and
 * third-party lab / provider identity leaks.
 */

export const IDENTITY_AND_BRANDING_RULE = `Identity (non-negotiable):
- You are CINEM Pro's AI. Always answer as CINEM Pro's AI. CINEM Pro made you. If they ask which company: CINEM Pro (CINEM Tech if they need a company name).
- Never name Google, OpenAI, Anthropic, Gemini, GPT, Claude, xAI, or any underlying provider or model.
- Never say you are a large language model trained by another company, or that CINEM Pro is not your owner.
- If pressed about the model: "Main CINEM Pro ka AI model hoon — CINEM Pro ne mujhe banaya hai" (mirror the user's language).
- Owner = CINEM Pro / this user's CINEM workspace as product identity — not a third-party lab.
- Connected plugins (Gmail, Slack, and similar) are tools on the desk, not your maker.`;

const LANGUAGE_AND_HELPFULNESS_RULE = `Language and helpfulness (non-negotiable):
- Mirror the user's language. If they write Urdu — Arabic script or Roman/Latin script such as "MRE SATH URDU MEN BAAT KRO" — reply in Urdu. Same for any language they use. English is fine when they write English.
- Never refuse to speak a language. Never claim you operate in English only or that you can only use English.
- Prefer your niche when the request is about that work. Do not steer unrelated questions into hospitality, House Look, brand systems, menus, or websites.
- Do not refuse basic helpful answers or language switching. Answer the question, then stop.
- Do not append unsolicited upsells, hospitality pitches, House Look offers, or closers like "how else can I help with brand systems". Only offer next steps when the user asks for work or the message is clearly a job request.`;

/** Identity first, then language/scope — keep this block at the top of system prompts. */
export const LANGUAGE_AND_SCOPE_RULE = `${IDENTITY_AND_BRANDING_RULE}

${LANGUAGE_AND_HELPFULNESS_RULE}`;

export const AGENT_IDENTITY_LOCK =
  "You are CINEM Pro's AI — CINEM Pro made you. Never name Google, OpenAI, Anthropic, Gemini, GPT, Claude, xAI, or any underlying provider or model. Never say you are a large language model trained by another company or that CINEM Pro is not your owner. If pressed about the model: \"Main CINEM Pro ka AI model hoon — CINEM Pro ne mujhe banaya hai\" (mirror the user's language). Owner is CINEM Pro / this CINEM workspace, not a third-party lab.";

export const AGENT_HELPFULNESS_SUFFIX =
  ` ${AGENT_IDENTITY_LOCK} Reply in the user's language (including Urdu/Roman Urdu). Never claim English-only. Prefer this role's niche when the request is about that work, but do not refuse basic helpful answers. Answer the question and stop. Do not append unsolicited upsells, hospitality pitches, House Look offers, or brand-system closers. Only offer next steps when the user asks for work or the message is clearly a job request.`;

const NO_PITCH_MARKER = "Do not append unsolicited";
const IDENTITY_MARKER = "CINEM Pro's AI";
const LANGUAGE_MARKER = "Never refuse to speak a language";
const AGENT_LANGUAGE_MARKER = "Never claim English-only";
const PROVIDER_FORBID_MARKER = "Never name Google, OpenAI, Anthropic, Gemini, GPT, Claude, xAI";

/** Old PR #57 closer that made every reply end in a brand/hospitality pitch. */
const LEGACY_PITCH = [
  /(?:,?\s*)?(?:For general Q&A on the desk, )?(?:—\s*)?answer briefly, then offer(?: to help with)? brand or desk work\.?/gi,
  /then offer(?: to help with)? brand or desk work\.?/gi,
];

/**
 * Marketplace / stored copy that could leak a third-party lab as the maker.
 * Does not strip the identity lock's own "Never name Google…" denylist.
 */
const PROVIDER_DISCLOSURE = [
  /\bGoogle made me\.?/gi,
  /\bCINEM Pro is not (?:my |the )(?:owner|maker)\.?/gi,
  /\bI(?:'m| am) a large language model trained by [^.]+\.?/gi,
  /\b(?:powered|trained|made|built|created) by (?:Google|OpenAI|Anthropic|Gemini|xAI|Open ?AI)(?:'s)?(?:\s+(?:Gemini|GPT|Claude|Grok))?[^.]*\.?/gi,
  /\bI(?:'m| am) (?:Google(?:'s)?|OpenAI(?:'s)?|Anthropic(?:'s)?|xAI(?:'s)?)(?:\s+(?:Gemini|GPT|Claude|Grok))?(?:\s+model)?\.?/gi,
  /\bI(?:'m| am) (?:Gemini(?:\s+[\w.]+)?|GPT-?\d*(?:o)?(?:\s*mini)?|ChatGPT|Claude(?:\s+[\w.]+)?|Grok(?:\s+[\w.]+)?)\b[^.]*\.?/gi,
];

export function withoutLegacyPitch(text: string): string {
  let next = text;
  for (const pattern of LEGACY_PITCH) {
    pattern.lastIndex = 0;
    next = next.replace(pattern, "");
  }
  return next
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function withoutProviderDisclosure(text: string): string {
  const lines = text.split("\n");
  const next = lines
    .map((line) => {
      if (line.includes(PROVIDER_FORBID_MARKER) || line.includes(IDENTITY_MARKER)) {
        return line;
      }
      let out = line;
      for (const pattern of PROVIDER_DISCLOSURE) {
        pattern.lastIndex = 0;
        out = out.replace(pattern, "");
      }
      return out;
    })
    .join("\n");
  return next
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function scrubPromptBody(text: string): string {
  return withoutProviderDisclosure(withoutLegacyPitch(text));
}

function hasIdentityLock(text: string): boolean {
  return text.includes(IDENTITY_MARKER) && text.includes(PROVIDER_FORBID_MARKER);
}

export function withLanguagePolicy(system: string): string {
  const body = scrubPromptBody(system.trim());
  if (!body) return LANGUAGE_AND_SCOPE_RULE;
  if (hasIdentityLock(body) && body.includes(LANGUAGE_MARKER) && body.includes(NO_PITCH_MARKER)) {
    return body;
  }
  return `${LANGUAGE_AND_SCOPE_RULE}\n\n${body}`;
}

export function withAgentHelpfulness(instructions: string): string {
  const body = scrubPromptBody(instructions.trim());
  if (!body) return AGENT_HELPFULNESS_SUFFIX.trim();
  if (
    hasIdentityLock(body) &&
    body.includes(AGENT_LANGUAGE_MARKER) &&
    body.includes(NO_PITCH_MARKER)
  ) {
    return body;
  }
  if (body.includes(AGENT_LANGUAGE_MARKER) && body.includes(NO_PITCH_MARKER)) {
    return `${AGENT_IDENTITY_LOCK} ${body}`.trim();
  }
  return `${AGENT_IDENTITY_LOCK} ${body} ${AGENT_HELPFULNESS_SUFFIX}`.trim();
}

export function messagesWithLanguagePolicy<
  T extends { role: "system" | "user" | "assistant"; content: string },
>(messages: T[], kind?: string): T[] {
  if (kind === "classify") return messages;
  const system = messages.filter((row) => row.role === "system");
  const rest = messages.filter((row) => row.role !== "system");
  const combined = system.map((row) => row.content).join("\n\n");
  const next = withLanguagePolicy(combined);
  return [{ role: "system", content: next } as T, ...rest];
}
