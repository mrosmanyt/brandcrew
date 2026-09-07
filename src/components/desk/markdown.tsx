function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function renderInline(text: string) {
  const escaped = escapeHtml(text);
  return escaped
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`(.+?)`/g, "<code>$1</code>");
}

export function MarkdownBody({ content }: { content: string }) {
  const blocks = content.replace(/\r\n/g, "\n").split("\n");
  const html: string[] = [];
  let inTable = false;
  let listOpen = false;

  const closeList = () => {
    if (listOpen) {
      html.push("</ul>");
      listOpen = false;
    }
  };

  for (const raw of blocks) {
    const line = raw.trimEnd();
    if (line.startsWith("|")) {
      closeList();
      if (!inTable) {
        html.push("<table><tbody>");
        inTable = true;
      }
      if (/^\|?\s*-+/.test(line.replaceAll("|", "").trim()) || line.includes("---")) {
        continue;
      }
      const cells = line
        .split("|")
        .slice(1, -1)
        .map((cell) => `<td>${renderInline(cell.trim())}</td>`)
        .join("");
      html.push(`<tr>${cells}</tr>`);
      continue;
    }
    if (inTable) {
      html.push("</tbody></table>");
      inTable = false;
    }
    if (line.startsWith("# ")) {
      closeList();
      html.push(`<h1>${renderInline(line.slice(2))}</h1>`);
    } else if (line.startsWith("## ")) {
      closeList();
      html.push(`<h2>${renderInline(line.slice(3))}</h2>`);
    } else if (line.startsWith("### ")) {
      closeList();
      html.push(`<h3>${renderInline(line.slice(4))}</h3>`);
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      if (!listOpen) {
        html.push("<ul>");
        listOpen = true;
      }
      html.push(`<li>${renderInline(line.slice(2))}</li>`);
    } else if (/^\d+\.\s/.test(line)) {
      closeList();
      html.push(`<p>${renderInline(line)}</p>`);
    } else if (!line.trim()) {
      closeList();
    } else {
      closeList();
      html.push(`<p>${renderInline(line)}</p>`);
    }
  }
  closeList();
  if (inTable) html.push("</tbody></table>");

  return (
    <div
      className="prose-artifact"
      dangerouslySetInnerHTML={{ __html: html.join("") }}
    />
  );
}
