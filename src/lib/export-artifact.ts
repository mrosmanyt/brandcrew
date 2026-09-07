/** Client + server helpers for artifact copy / download / print-to-PDF. No extra deps. */

export function artifactMarkdown(input: { title: string; content: string; type?: string }) {
  const body = input.content.trim();
  if (body.startsWith("#")) return body.endsWith("\n") ? body : `${body}\n`;
  return `# ${input.title}\n\n${body}\n`;
}

export function downloadTextFile(filename: string, text: string, mime = "text/markdown;charset=utf-8") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function safeDownloadName(title: string) {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 48);
  return `${base || "artifact"}.md`;
}

export function printArtifactHtml(title: string, content: string) {
  const escaped = content
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${title.replace(/</g, "")}</title>
<style>
  body { font: 14px/1.5 ui-sans-serif, system-ui, sans-serif; padding: 32px; max-width: 40rem; }
  h1 { font-size: 1.4rem; }
  pre { white-space: pre-wrap; }
</style></head><body>
<h1>${title.replace(/</g, "")}</h1>
<pre>${escaped}</pre>
<script>window.onload=function(){window.print();}</script>
</body></html>`;
  const popup = window.open("", "_blank", "noopener,noreferrer,width=800,height=900");
  if (!popup) return false;
  popup.document.write(html);
  popup.document.close();
  return true;
}

function escapePdf(text: string) {
  return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function wrapPdfLines(text: string, maxChars: number) {
  const lines: string[] = [];
  for (const raw of text.replace(/\r\n/g, "\n").split("\n")) {
    const row = raw.length ? raw : " ";
    if (row.length <= maxChars) {
      lines.push(row);
      continue;
    }
    let rest = row;
    while (rest.length > maxChars) {
      let cut = rest.lastIndexOf(" ", maxChars);
      if (cut < 20) cut = maxChars;
      lines.push(rest.slice(0, cut));
      rest = rest.slice(cut).trimStart();
    }
    if (rest) lines.push(rest);
  }
  return lines.slice(0, 400);
}

/** Minimal multi-page PDF (Helvetica). Browser print-to-PDF is the nicer path. */
export function artifactPdfBytes(title: string, content: string): Uint8Array {
  const lines = wrapPdfLines(`${title}\n\n${content}`, 90);
  const linesPerPage = 48;
  const pages: string[][] = [];
  for (let i = 0; i < lines.length; i += linesPerPage) {
    pages.push(lines.slice(i, i + linesPerPage));
  }
  if (!pages.length) pages.push([title]);

  const objects: string[] = [];
  const kids: string[] = [];
  let obj = 3;
  for (const pageLines of pages) {
    const stream = [
      "BT",
      "/F1 11 Tf",
      "14 TL",
      "48 744 Td",
      ...pageLines.map((line, index) => {
        const escaped = escapePdf(line.slice(0, 120));
        return index === 0 ? `(${escaped}) Tj` : `T* (${escaped}) Tj`;
      }),
      "ET",
    ].join("\n");
    const contentObj = obj;
    const pageObj = obj + 1;
    objects.push(
      `${contentObj} 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`,
    );
    objects.push(
      `${pageObj} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${contentObj} 0 R /Resources << /Font << /F1 1 0 R >> >> >>\nendobj\n`,
    );
    kids.push(`${pageObj} 0 R`);
    obj += 2;
  }

  const font = `1 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`;
  const pagesObj = `2 0 obj\n<< /Type /Pages /Kids [${kids.join(" ")}] /Count ${pages.length} >>\nendobj\n`;
  const catalog = `${obj} 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`;
  const body = [font, pagesObj, ...objects, catalog].join("");
  const header = "%PDF-1.4\n";
  const offsets = [0];
  let cursor = header.length;
  const parts = [font, pagesObj, ...objects, catalog];
  for (const part of parts) {
    offsets.push(cursor);
    cursor += part.length;
  }
  const xrefStart = cursor;
  const xref = [
    "xref",
    `0 ${offsets.length}`,
    "0000000000 65535 f ",
    ...offsets.slice(1).map((off) => `${String(off).padStart(10, "0")} 00000 n `),
    "trailer",
    `<< /Size ${offsets.length} /Root ${obj} 0 R >>`,
    "startxref",
    String(xrefStart),
    "%%EOF",
  ].join("\n");
  const pdf = header + body + xref;
  return new TextEncoder().encode(pdf);
}

export function downloadPdf(filename: string, title: string, content: string) {
  const bytes = artifactPdfBytes(title, content);
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const blob = new Blob([copy.buffer as ArrayBuffer], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.replace(/\.md$/i, ".pdf");
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function estimateUsdStub(tokens: number) {
  return Math.round((tokens / 100_000) * 0.5 * 100) / 100;
}
