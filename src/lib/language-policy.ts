/**
 * Global language + scope rules for desk Q&A and agent jobs.
 * Stored agent instructions may still prefer a niche; this layer overrides
 * English-only / hospitality-only refusals and unsolicited sales closers.
 */

export const LANGUAGE_AND_SCOPE_RULE = `Language and helpfulness (non-negotiable):
- Mirror the user's language. If they write Urdu — Arabic script or Roman/Latin script such as "MRE SATH URDU MEN BAAT KRO" — reply in Urdu. Same for any language they use. English is fine when they write English.
- Never refuse to speak a language. Never claim you operate in English only or that you can only use English.
- Prefer your niche when the request is about that work. Do not steer unrelated questions into hospitality, House Look, brand systems, menus, or websites.
- Do not refuse basic helpful answers or language switching. Answer the question, then stop.
- Do not append unsolicited upsells, hospitality pitches, House Look offers, or closers like "how else can I help with brand systems". Only offer next steps when the user asks for work or the message is clearly a job request.`;

export const AGENT_HELPFULNESS_SUFFIX =
  " Reply in the user's language (including Urdu/Roman Urdu). Never claim English-only. Prefer this role's niche when the request is about that work, but do not refuse basic helpful answers. Answer the question and stop. Do not append unsolicited upsells, hospitality pitches, House Look offers, or brand-system closers. Only offer next steps when the user asks for work or the message is clearly a job request.";

const NO_PITCH_MARKER = "Do not append unsolicited";

/** Old PR #57 closer that made every reply end in a brand/hospitality pitch. */
const LEGACY_PITCH = [
  /(?:,?\s*)?(?:For general Q&A on the desk, )?(?:—\s*)?answer briefly, then offer(?: to help with)? brand or desk work\.?/gi,
  /then offer(?: to help with)? brand or desk work\.?/gi,
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

export function withLanguagePolicy(system: string): string {
  const body = withoutLegacyPitch(system.trim());
  if (!body) return LANGUAGE_AND_SCOPE_RULE;
  if (body.includes("Never refuse to speak a language") && body.includes(NO_PITCH_MARKER)) {
    return body;
  }
  if (body.includes("Never refuse to speak a language")) {
    return `${LANGUAGE_AND_SCOPE_RULE}\n\n${body}`;
  }
  return `${LANGUAGE_AND_SCOPE_RULE}\n\n${body}`;
}

export function withAgentHelpfulness(instructions: string): string {
  const body = withoutLegacyPitch(instructions.trim());
  if (!body) return AGENT_HELPFULNESS_SUFFIX.trim();
  if (body.includes("Never claim English-only") && body.includes(NO_PITCH_MARKER)) {
    return body;
  }
  if (body.includes("Never claim English-only")) {
    return `${body} ${AGENT_HELPFULNESS_SUFFIX}`.trim();
  }
  return `${body} ${AGENT_HELPFULNESS_SUFFIX}`.trim();
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
