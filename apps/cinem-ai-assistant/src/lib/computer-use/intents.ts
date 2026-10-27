/** Detect computer-use handoff from natural language. */
export function isComputerUseCommand(text: string): boolean {
  const t = text.toLowerCase();
  return (
    /\b(computer[- ]?use|desktop control|control my (pc|desktop|computer))\b/.test(t) ||
    /\b(open|focus|launch)\b.*\b(explorer|file explorer|chrome|edge|chatgpt|premiere)\b/.test(t) ||
    /\buse my computer\b/.test(t)
  );
}
