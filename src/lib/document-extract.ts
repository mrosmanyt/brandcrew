/**
 * Server-side document text extraction for composer attachments
 * (Package 6 — document intelligence).
 *
 * PDF (.pdf), Word (.docx), and Excel (.xlsx) attachments arrive as base64
 * `data` on the existing attachments pipeline; this module turns the bytes
 * into plain text at send time, before the turn is persisted, so the stored
 * attachment carries the extracted `text` (raw bytes are dropped) and the
 * chat model can answer questions, summarize, and pull tables/data out of
 * it. CSV keeps riding the older text-file path (its text is inlined as-is,
 * which is the same table data, tab/comma separated).
 *
 * Honesty rules: a file that cannot be parsed, or parses to no text,
 * produces an `error` state on the attachment — never a fake success and
 * never invented contents. Extracted text is capped per file and per
 * message; anything cut off says so inside the text itself, so the model
 * (and the user) can see the content was truncated.
 *
 * Server-only: imports Node parsers (unpdf / mammoth / exceljs). Never
 * import this from client components.
 */

import ExcelJS from "exceljs";
import mammoth from "mammoth";
import { extractText } from "unpdf";
import type { ComposerAttachment } from "@/lib/composer";
import { stripDataUrlPrefix } from "@/lib/composer-media";

/**
 * Per-file cap on extracted characters. Kept just under the 20,000-char
 * `text` limit the attachment schema enforces, so the truncation note
 * still fits when a stored attachment is sent back on a later turn.
 */
export const MAX_EXTRACTED_CHARS_PER_FILE = 19_800;
/** Total extracted characters across all documents in one message. */
export const MAX_EXTRACTED_CHARS_TOTAL = 40_000;

const TRUNCATION_NOTE =
  "\n\n[Note: the document text above was cut off — the rest of the document was not included. Say so if the answer may be in the missing part.]";

export type DocumentExtraction =
  | { ok: true; text: string; truncated: boolean }
  | { ok: false; error: string };

/** Slice `text` to at most `limit` chars, ending with the truncation note. */
function clipWithNote(text: string, limit: number): string {
  if (text.length <= limit) return text;
  return `${text.slice(0, Math.max(0, limit - TRUNCATION_NOTE.length))}${TRUNCATION_NOTE}`;
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  const { text } = await extractText(new Uint8Array(buffer), {
    mergePages: true,
  });
  return text;
}

async function extractDocxText(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    const record = value as unknown as Record<string, unknown>;
    // Hyperlink cells carry their display text.
    if (typeof record.text === "string") return record.text;
    // Rich text runs.
    if (Array.isArray(record.richText)) {
      return record.richText
        .map((run) =>
          typeof (run as { text?: unknown }).text === "string"
            ? (run as { text: string }).text
            : "",
        )
        .join("");
    }
    // Formula cells carry their last computed result.
    if ("result" in record) {
      return cellText(record.result as ExcelJS.CellValue);
    }
    return "";
  }
  return String(value);
}

async function extractXlsxText(buffer: Buffer): Promise<string> {
  const workbook = new ExcelJS.Workbook();
  // ExcelJS's bundled types declare their own Buffer shape; cast to the
  // loader's exact parameter type so this compiles against any @types/node.
  await workbook.xlsx.load(
    buffer as unknown as Parameters<ExcelJS.Xlsx["load"]>[0],
  );
  const sections: string[] = [];
  workbook.eachSheet((sheet) => {
    const lines: string[] = [`Sheet: ${sheet.name}`];
    sheet.eachRow((row) => {
      const cells: string[] = [];
      row.eachCell({ includeEmpty: true }, (cell) => {
        cells.push(cellText(cell.value));
      });
      while (cells.length && cells[cells.length - 1] === "") cells.pop();
      lines.push(cells.join("\t"));
    });
    sections.push(lines.join("\n"));
  });
  return sections.join("\n\n");
}

/**
 * Extract plain text from one document attachment's base64 bytes.
 * Dispatch is by file extension first, then by declared mime.
 */
export async function extractDocumentText(file: {
  name: string;
  mime?: string;
  data: string;
}): Promise<DocumentExtraction> {
  let buffer: Buffer;
  try {
    buffer = Buffer.from(stripDataUrlPrefix(file.data), "base64");
  } catch {
    buffer = Buffer.alloc(0);
  }
  if (!buffer.length) {
    return {
      ok: false,
      error: `${file.name} could not be read — the file appears to be empty or damaged.`,
    };
  }
  const lower = file.name.toLowerCase();
  const mime = (file.mime || "").toLowerCase();
  try {
    let raw: string;
    if (lower.endsWith(".docx")) {
      raw = await extractDocxText(buffer);
    } else if (lower.endsWith(".xlsx")) {
      raw = await extractXlsxText(buffer);
    } else if (lower.endsWith(".pdf") || mime === "application/pdf") {
      raw = await extractPdfText(buffer);
    } else {
      return {
        ok: false,
        error: `${file.name} is not a supported document. Attach a PDF, Word (.docx), or Excel (.xlsx) file.`,
      };
    }
    const text = raw.replace(/\r\n/g, "\n").trim();
    if (!text) {
      return {
        ok: false,
        error: `${file.name} was opened, but no text could be found in it. If it is a scanned document, attach a clear photo of it instead.`,
      };
    }
    const truncated = text.length > MAX_EXTRACTED_CHARS_PER_FILE;
    return {
      ok: true,
      text: clipWithNote(text, MAX_EXTRACTED_CHARS_PER_FILE),
      truncated,
    };
  } catch {
    return {
      ok: false,
      error: `${file.name} could not be read — the file appears to be damaged or in a format we cannot open. Try a PDF, Word (.docx), or Excel (.xlsx) file.`,
    };
  }
}

/**
 * Run extraction over one message's attachments. Successful documents come
 * back with `text` set and raw `data` dropped (so storage keeps the text,
 * not megabytes of base64); failures come back with an honest `error` and
 * are also listed in `failures` so the caller can tell the user plainly.
 * Attachments that already carry text, and all non-document kinds, pass
 * through untouched.
 */
export async function enrichDocumentAttachments(
  files: ComposerAttachment[],
): Promise<{ files: ComposerAttachment[]; failures: string[] }> {
  const out: ComposerAttachment[] = [];
  const failures: string[] = [];
  let usedChars = 0;
  for (const file of files) {
    const data = file.data;
    if (file.kind !== "document" || file.error || !data) {
      if (file.kind === "document" && file.text?.trim()) {
        usedChars += file.text.trim().length;
      }
      out.push(file);
      continue;
    }
    const result = await extractDocumentText({
      name: file.name,
      mime: file.mime,
      data,
    });
    if (!result.ok) {
      failures.push(result.error);
      out.push({
        name: file.name,
        size: file.size,
        kind: "document",
        mime: file.mime,
        error: result.error,
      });
      continue;
    }
    const remaining = MAX_EXTRACTED_CHARS_TOTAL - usedChars;
    if (remaining <= 0) {
      const error = `${file.name} was skipped — this message already carries as much document text as one turn can include. Send it in a separate message.`;
      failures.push(error);
      out.push({
        name: file.name,
        size: file.size,
        kind: "document",
        mime: file.mime,
        error,
      });
      continue;
    }
    const text =
      result.text.length > remaining
        ? clipWithNote(result.text, remaining)
        : result.text;
    usedChars += text.length;
    out.push({
      name: file.name,
      size: file.size,
      kind: "document",
      mime: file.mime,
      text,
    });
  }
  return { files: out, failures };
}
