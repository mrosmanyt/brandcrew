/**
 * Server-side text extraction for uploaded files. Runs where the API route
 * runs (server), not on the user's machine — the desktop app still has to
 * ship the bytes here, same as any other job attachment.
 */

const MAX_EXTRACT_CHARS = 20_000;

export type ExtractedFile = {
  fileName: string;
  mimeType: string;
  text: string;
  truncated: boolean;
};

export async function extractFileText(
  fileName: string,
  mimeType: string,
  buffer: Buffer,
): Promise<ExtractedFile> {
  let text: string;

  if (mimeType === "application/pdf" || fileName.toLowerCase().endsWith(".pdf")) {
    const pdfParse = (await import("pdf-parse")).default;
    const parsed = await pdfParse(buffer);
    text = parsed.text;
  } else if (mimeType.startsWith("text/") || /\.(txt|md|csv|json)$/i.test(fileName)) {
    text = buffer.toString("utf-8");
  } else {
    throw new Error(
      "Unsupported file type — only PDF and plain-text files (.txt, .md, .csv, .json) are extracted today.",
    );
  }

  const truncated = text.length > MAX_EXTRACT_CHARS;
  return {
    fileName,
    mimeType,
    text: truncated ? text.slice(0, MAX_EXTRACT_CHARS) : text,
    truncated,
  };
}
