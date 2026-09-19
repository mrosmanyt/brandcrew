/**
 * Pure heuristics — does this user message warrant the multi-layer orchestrator?
 * Supports compound requests like weather + research + planners in one utterance.
 */

const COMPOUND_CONNECTORS =
  /\b(?:and then|then|also|plus|after that|next|,\s*and\b|\band\b|\bthen\b|\bplus\b|\balso\b)/i;

const LAYER_HINTS = [
  /\b(?:go to|open|visit|browse|google)\b/i,
  /\b(?:weather|forecast|temperature)\b/i,
  /\b(?:research|look up|find out|latest)\b/i,
  /\b(?:news|headlines|world news|tech news)\b/i,
  /\b(?:build|create|make|plan|design|draft)\b/i,
  /\b(?:event planner|diet plan|meal plan|workout plan|schedule)\b/i,
  /\b(?:download|premiere|chatgpt|computer|desktop)\b/i,
  /\b(?:image|picture|generate|draw)\b/i,
];

/** Minimum distinct layer hints to trigger multilayer path. */
const MIN_LAYERS = 2;

export function countLayerHints(text: string): number {
  const t = text.trim();
  if (!t) return 0;
  let hits = 0;
  for (const re of LAYER_HINTS) {
    if (re.test(t)) hits++;
  }
  return hits;
}

export function isMultilayerRequest(text: string): boolean {
  const t = text.trim();
  if (t.length < 40) return false;

  const layers = countLayerHints(t);
  const words = t.split(/\s+/).length;
  const hasCompound = COMPOUND_CONNECTORS.test(t);
  const listLike = (t.match(/,\s*\w+/g) ?? []).length >= 2;

  // Example compound: "go to google, check weather, research AI, build event planner"
  if (layers >= 3 && (hasCompound || listLike)) return true;
  if (layers >= MIN_LAYERS && hasCompound && words >= 12) return true;
  if (layers >= 4) return true;

  return false;
}
