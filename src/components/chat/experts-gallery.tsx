"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { expertsByCategory, type Expert } from "@/lib/experts";

/**
 * Experts gallery (Package 5). Curated personas from src/lib/experts.ts.
 * "Start chat" creates a real ChatConversation with the expert persisted
 * on it via the existing conversations API, then opens it in /chat —
 * replies flow through the normal chat stream (a working model key is
 * still required, exactly like any other chat).
 */
export function ExpertsGallery({ userName }: { userName: string }) {
  const router = useRouter();
  const [startingId, setStartingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startChat = async (expert: Expert) => {
    if (startingId) return;
    setError(null);
    setStartingId(expert.id);
    try {
      const response = await fetch("/api/chat/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expertId: expert.id, title: expert.name }),
      });
      if (!response.ok) throw new Error("create failed");
      const data = (await response.json()) as {
        conversation: { id: string };
      };
      router.push(`/chat?conversation=${data.conversation.id}`);
    } catch {
      setError("Could not start that chat. Try again.");
      setStartingId(null);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
        <Link
          href="/chat"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to chat
        </Link>
        <h1 className="mt-4 font-heading text-3xl tracking-tight md:text-4xl">
          Experts
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Pick a specialist, {userName ? `${userName.split(" ")[0]}, ` : ""}and a
          new chat opens with that expert&apos;s know-how already loaded —
          their guidance stays active for the whole conversation.
        </p>
        {error ? (
          <p className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        {expertsByCategory().map((group) => (
          <section key={group.category} className="mt-10">
            <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {group.category}
            </h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {group.experts.map((expert) => (
                <article
                  key={expert.id}
                  className="flex flex-col rounded-3xl border border-border bg-card p-5 shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <span
                      aria-hidden
                      className="flex size-11 shrink-0 items-center justify-center rounded-2xl text-sm font-bold text-white"
                      style={{ backgroundColor: expert.color }}
                    >
                      {expert.letter}
                    </span>
                    <h3 className="font-heading text-lg leading-tight tracking-tight">
                      {expert.name}
                    </h3>
                  </div>
                  <p className="mt-3 flex-1 text-sm leading-6 text-muted-foreground">
                    {expert.tagline}
                  </p>
                  <p className="mt-3 text-xs leading-5 text-muted-foreground">
                    Try: “{expert.starters[0]}”
                  </p>
                  <button
                    type="button"
                    onClick={() => void startChat(expert)}
                    disabled={startingId !== null}
                    className="mt-4 inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
                  >
                    {startingId === expert.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <ArrowRight className="size-4" />
                    )}
                    Start chat
                  </button>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
