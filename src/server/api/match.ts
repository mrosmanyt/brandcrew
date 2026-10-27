export type RouteParams = Record<string, string>;

export type PatternMatch = {
  score: number;
  params: RouteParams;
  pattern: string[];
};

export function pathToSegments(pathname: string): string[] {
  return pathname.replace(/\/+$/, "").split("/").filter(Boolean);
}

export function matchPattern(
  pattern: string[],
  segments: string[],
): { score: number; params: RouteParams } | null {
  if (pattern.length !== segments.length) return null;
  const params: RouteParams = {};
  let score = 0;
  for (let i = 0; i < pattern.length; i++) {
    const part = pattern[i];
    const value = segments[i];
    if (part.startsWith(":")) {
      params[part.slice(1)] = decodeURIComponent(value);
    } else if (part === value) {
      score += 1;
    } else {
      return null;
    }
  }
  return { score, params };
}

export function matchBestPattern(
  patterns: string[][],
  segments: string[],
): PatternMatch | null {
  let best: PatternMatch | null = null;
  for (const pattern of patterns) {
    const hit = matchPattern(pattern, segments);
    if (!hit) continue;
    if (!best || hit.score > best.score) {
      best = { ...hit, pattern };
    }
  }
  return best;
}
