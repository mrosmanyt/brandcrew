import type { Metadata } from "next";
import Link from "next/link";
import { PhotoStudio } from "@/components/studio/photo-studio";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "AI Photo Studio — CINEM Pro",
  description:
    "Turn a photo into a professional headshot, fan poster, greeting card and more with CINEM Pro's AI Photo Studio — then share it anywhere.",
};

export default async function StudioPage() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 text-foreground">
        <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 text-center shadow-sm">
          <h1 className="font-heading text-2xl tracking-tight">AI Photo Studio</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Sign in to restyle your photos — headshots, fan posters, greeting
            cards, restorations — and share them with a link.
          </p>
          <Link
            href="/login"
            className="mt-4 inline-flex h-10 items-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }
  return <PhotoStudio userName={user.name} />;
}
