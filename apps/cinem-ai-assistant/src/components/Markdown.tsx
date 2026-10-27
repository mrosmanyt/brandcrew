import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Renders assistant markdown (headings, bullet/numbered lists, tables, code,
 * bold/italic) themed for Cinem AI Assistant's neon UI. Used for professional deliverables.
 */
export default function Markdown({ children }: { children: string }) {
  return (
    <div className="md-content">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
