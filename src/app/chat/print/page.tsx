"use client";

import { useEffect, useState } from "react";
import { Printer } from "lucide-react";
import { ChatMarkdown } from "@/components/chat/chat-markdown";
import { RESEARCH_PRINT_STORAGE_KEY } from "@/components/chat/chat-message";

type PrintPayload = {
  content: string;
  sources: { title: string; url: string }[];
};

/**
 * Print/PDF-friendly view of a deep-research report. The chat page hands
 * the report over via sessionStorage (same tab session, nothing uploaded);
 * this page renders it on a clean white sheet with a source list so the
 * browser's "Save as PDF" produces a tidy document.
 */
export default function ChatPrintPage() {
  const [payload, setPayload] = useState<PrintPayload | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(RESEARCH_PRINT_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as PrintPayload;
        if (parsed && typeof parsed.content === "string") {
          setPayload({
            content: parsed.content,
            sources: Array.isArray(parsed.sources) ? parsed.sources : [],
          });
        }
      }
    } catch {
      // Corrupt payload — fall through to the empty state below.
    }
    setLoaded(true);
  }, []);

  return (
    <div className="min-h-screen bg-white text-black">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
        }
        @page { margin: 2cm; }
      `}</style>
      <div className="no-print flex items-center justify-between border-b border-neutral-200 px-6 py-3">
        <p className="text-sm text-neutral-600">
          Print preview — use your browser&apos;s print dialog to save as PDF.
        </p>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-full bg-black px-4 py-2 text-sm font-medium text-white transition hover:opacity-85"
        >
          <Printer className="size-4" />
          Print / Save as PDF
        </button>
      </div>
      <main className="mx-auto w-full max-w-3xl px-6 py-10">
        {!loaded ? (
          <p className="text-sm text-neutral-500">Loading report…</p>
        ) : payload ? (
          <>
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
              CINEM Pro — Deep Research Report
            </p>
            <div className="mt-4">
              <ChatMarkdown content={payload.content} />
            </div>
            {payload.sources.length ? (
              <section className="mt-10 border-t border-neutral-200 pt-6">
                <h2 className="text-base font-semibold">Sources</h2>
                <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm leading-6">
                  {payload.sources.map((source, index) => (
                    <li key={`${source.url}-${index}`}>
                      <span className="font-medium">{source.title}</span>
                      <br />
                      <span className="break-all text-neutral-600">
                        {source.url}
                      </span>
                    </li>
                  ))}
                </ol>
              </section>
            ) : null}
          </>
        ) : (
          <p className="text-sm leading-6 text-neutral-600">
            No report was handed over to this view. Open a chat, find a
            deep-research report, and use its “Print / PDF” button — the
            report opens here ready to print.
          </p>
        )}
      </main>
    </div>
  );
}
