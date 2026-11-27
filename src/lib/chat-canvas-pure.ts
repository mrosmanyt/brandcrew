/**
 * Canvas workspace — pure logic (no DB, no providers).
 *
 * The cost rule the owner asked for lives here: a canvas document is
 * split into numbered blocks (runs of non-blank lines), the model is
 * shown the blocks and may ONLY answer with targeted edit operations
 * (replace / insert_after / delete on block numbers). The full document
 * is never regenerated per turn — the model returns just the changed
 * blocks, and this module applies them to the original block array.
 * An operation that cannot be applied cleanly is reported as skipped;
 * nothing here ever falls back to replacing the whole document.
 */

export const CANVAS_CONTENT_MAX_CHARS = 200_000;
/** AI edits need the whole document in the prompt; cap what one edit may span. */
export const CANVAS_AI_EDIT_MAX_CHARS = 60_000;
export const CANVAS_TITLE_MAX = 120;
export const CANVAS_MAX_OPS = 50;

export type CanvasEditOp =
  | { op: "replace"; block: number; text: string }
  | { op: "insert_after"; block: number; text: string }
  | { op: "delete"; block: number };

export type CanvasBlockSplit = {
  blocks: string[];
  /** Blank-line count before each block (gaps[0] = leading blank lines). */
  gaps: number[];
  /** Blank lines after the last block. */
  trailing: number;
};

/**
 * Split content into blocks of consecutive non-blank lines. Lossless:
 * joinCanvasBlocks(splitCanvasBlocks(x)) === x for any document made of
 * text lines (a whitespace-only document is kept as one verbatim block).
 */
export function splitCanvasBlocks(content: string): CanvasBlockSplit {
  const lines = content.split("\n");
  const blocks: string[] = [];
  const gaps: number[] = [];
  let current: string[] = [];
  let currentGap = 0;
  let pendingBlanks = 0;
  for (const line of lines) {
    if (line.trim() === "") {
      if (current.length) {
        blocks.push(current.join("\n"));
        gaps.push(currentGap);
        current = [];
        pendingBlanks = 1;
      } else {
        pendingBlanks += 1;
      }
    } else {
      if (!current.length) {
        currentGap = pendingBlanks;
        pendingBlanks = 0;
      }
      current.push(line);
    }
  }
  let trailing = 0;
  if (current.length) {
    blocks.push(current.join("\n"));
    gaps.push(currentGap);
  } else {
    trailing = pendingBlanks;
  }
  if (!blocks.length) {
    return { blocks: [content], gaps: [0], trailing: 0 };
  }
  return { blocks, gaps, trailing };
}

export function joinCanvasBlocks(split: CanvasBlockSplit): string {
  const lines: string[] = [];
  split.blocks.forEach((block, index) => {
    const gap = split.gaps[index] ?? 0;
    for (let i = 0; i < gap; i += 1) lines.push("");
    lines.push(...block.split("\n"));
  });
  for (let i = 0; i < split.trailing; i += 1) lines.push("");
  return lines.join("\n");
}

export type CanvasOpOutcome = {
  op: CanvasEditOp;
  applied: boolean;
  /** Why the op was skipped (present only when applied is false). */
  reason?: string;
};

export type CanvasApplyResult = {
  content: string;
  outcomes: CanvasOpOutcome[];
  appliedCount: number;
  skippedCount: number;
};

/**
 * Apply model edit operations against the ORIGINAL block numbering.
 * Conflicting ops on one block: the first wins, later ones are skipped
 * with a reason. Inserts anchored to a deleted block still land at that
 * position. Nothing is applied silently — every op gets an outcome.
 */
export function applyCanvasEditOps(
  split: CanvasBlockSplit,
  ops: CanvasEditOp[],
): CanvasApplyResult {
  const total = split.blocks.length;
  const outcomes: CanvasOpOutcome[] = [];
  const targeted = new Set<number>();
  const replacements = new Map<number, string>();
  const deletions = new Set<number>();
  const inserts = new Map<number, string[]>();

  for (const op of ops) {
    if (op.op === "insert_after") {
      if (!Number.isInteger(op.block) || op.block < 0 || op.block > total) {
        outcomes.push({ op, applied: false, reason: "anchor block out of range" });
        continue;
      }
      if (typeof op.text !== "string" || !op.text.trim()) {
        outcomes.push({ op, applied: false, reason: "empty text" });
        continue;
      }
      const list = inserts.get(op.block) ?? [];
      list.push(op.text);
      inserts.set(op.block, list);
      outcomes.push({ op, applied: true });
      continue;
    }
    if (!Number.isInteger(op.block) || op.block < 1 || op.block > total) {
      outcomes.push({ op, applied: false, reason: "block out of range" });
      continue;
    }
    if (targeted.has(op.block)) {
      outcomes.push({
        op,
        applied: false,
        reason: "another edit already changed this block",
      });
      continue;
    }
    if (op.op === "replace") {
      if (typeof op.text !== "string" || !op.text.trim()) {
        outcomes.push({ op, applied: false, reason: "empty replacement" });
        continue;
      }
      replacements.set(op.block, op.text);
    } else {
      deletions.add(op.block);
    }
    targeted.add(op.block);
    outcomes.push({ op, applied: true });
  }

  const blocks: string[] = [];
  const gaps: number[] = [];
  let emitted = 0;
  const emit = (text: string, naturalGap: number) => {
    blocks.push(text);
    gaps.push(emitted === 0 ? (split.gaps[0] ?? 0) : Math.max(1, naturalGap));
    emitted += 1;
  };
  for (const text of inserts.get(0) ?? []) emit(text, 1);
  for (let i = 1; i <= total; i += 1) {
    if (deletions.has(i)) {
      // Block removed; inserts anchored here are still emitted below.
    } else if (replacements.has(i)) {
      emit(replacements.get(i) as string, split.gaps[i - 1] ?? 1);
    } else {
      emit(split.blocks[i - 1], split.gaps[i - 1] ?? 1);
    }
    for (const text of inserts.get(i) ?? []) emit(text, 1);
  }

  const content = blocks.length
    ? joinCanvasBlocks({ blocks, gaps, trailing: split.trailing })
    : "";
  return {
    content,
    outcomes,
    appliedCount: outcomes.filter((row) => row.applied).length,
    skippedCount: outcomes.filter((row) => !row.applied).length,
  };
}

export const CANVAS_EDIT_SYSTEM_PROMPT = [
  "You are editing a document inside a canvas workspace. The document is split into numbered blocks.",
  "You must reply with ONLY a JSON object — no markdown fences, no commentary outside the JSON.",
  'Shape: {"summary": string, "edits": [edit, ...]} where each edit is one of:',
  '{"op": "replace", "block": N, "text": "..."} — replace block N entirely with text.',
  '{"op": "insert_after", "block": N, "text": "..."} — insert a new block after block N (block 0 means the very beginning).',
  '{"op": "delete", "block": N} — remove block N.',
  "Hard rules:",
  "- NEVER return the whole document. Only return blocks that actually change — this keeps edits small and cheap.",
  "- Block numbers always refer to the numbering in the document shown to you.",
  "- text is the complete new content of that one block (it may contain newlines). Do not wrap it in code fences.",
  "- Make the smallest set of edits that fully carries out the instruction. Keep everything the user did not ask to change.",
  "- summary is one or two sentences describing the change, written in the user's language.",
].join("\n");

export function buildCanvasEditUserPrompt(input: {
  title: string;
  kind: string;
  language: string;
  blocks: string[];
  instruction: string;
}): string {
  const typeLine =
    input.kind === "code"
      ? `Type: code${input.language ? ` (${input.language})` : ""}`
      : "Type: document (markdown)";
  const rendered = input.blocks
    .map((block, index) => `[Block ${index + 1}]\n${block}`)
    .join("\n\n");
  return [
    `Canvas title: ${input.title}`,
    typeLine,
    "",
    "Current content, split into numbered blocks:",
    "",
    rendered,
    "",
    `Instruction: ${input.instruction}`,
    "",
    "Reply with ONLY the JSON object described in the system prompt.",
  ].join("\n");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseEditOp(value: unknown): CanvasEditOp | null {
  if (!isRecord(value)) return null;
  const block = value.block;
  if (typeof block !== "number" || !Number.isInteger(block)) return null;
  if (value.op === "delete") return { op: "delete", block };
  if (value.op === "replace" || value.op === "insert_after") {
    if (typeof value.text !== "string") return null;
    return { op: value.op, block, text: value.text };
  }
  return null;
}

/**
 * Parse the model's reply into a summary + validated ops. Returns null
 * when the reply carries no readable edits object at all — the caller
 * must then refuse the edit honestly instead of guessing.
 */
export function parseCanvasEditResponse(
  text: string,
): { summary: string; edits: CanvasEditOp[] } | null {
  let candidate = text.trim();
  const fenced = candidate.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) candidate = fenced[1].trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
  if (!isRecord(parsed) || !Array.isArray(parsed.edits)) return null;
  const edits: CanvasEditOp[] = [];
  for (const raw of parsed.edits.slice(0, CANVAS_MAX_OPS)) {
    const op = parseEditOp(raw);
    if (op) edits.push(op);
  }
  return {
    summary: typeof parsed.summary === "string" ? parsed.summary.trim() : "",
    edits,
  };
}

/** Seed a canvas from an assistant chat message (fenced code → code canvas). */
export function canvasSeedFromMessage(content: string): {
  title: string;
  kind: "document" | "code";
  language: string;
  content: string;
} {
  const trimmed = content.trim();
  const fence = trimmed.match(/^```([a-zA-Z0-9+#._-]*)\n([\s\S]*?)```$/);
  if (fence) {
    const language = (fence[1] || "").trim();
    const code = fence[2].replace(/\n$/, "");
    const firstLine =
      code.split("\n").find((line) => line.trim())?.trim() ?? "";
    return {
      title: (firstLine || "Code canvas").slice(0, 60),
      kind: "code",
      language,
      content: code,
    };
  }
  const heading = trimmed
    .split("\n")
    .find((line) => line.trim().startsWith("#"));
  const firstLine = trimmed.split("\n").find((line) => line.trim())?.trim() ?? "";
  const title =
    heading?.replace(/^#+\s*/, "").trim() || firstLine || "Untitled canvas";
  return {
    title: title.slice(0, 60),
    kind: "document",
    language: "",
    content,
  };
}

const CODE_EXTENSIONS: Record<string, string> = {
  python: "py",
  javascript: "js",
  typescript: "ts",
  tsx: "tsx",
  jsx: "jsx",
  html: "html",
  css: "css",
  json: "json",
  go: "go",
  rust: "rs",
  java: "java",
  c: "c",
  cpp: "cpp",
  "c++": "cpp",
  ruby: "rb",
  php: "php",
  sql: "sql",
  bash: "sh",
  shell: "sh",
  yaml: "yml",
  markdown: "md",
};

/** Download filename for a canvas: slugified title + the right extension. */
export function canvasDownloadName(
  title: string,
  kind: string,
  language: string,
): string {
  const slug =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "canvas";
  if (kind === "code") {
    const ext = CODE_EXTENSIONS[(language || "").toLowerCase()] ?? "txt";
    return `${slug}.${ext}`;
  }
  return `${slug}.md`;
}
