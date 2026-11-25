import type { Metadata } from "next";
import Link from "next/link";
import { ExpertsGallery } from "@/components/chat/experts-gallery";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Experts — CINEM Pro",
  description:
    "One-tap expert personas for CINEM Pro chat: CV expert, teacher, freelancer coach, business advisor, Urdu letter writer and more.",
};

export default async function ExpertsPage() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 text-foreground">
        <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 text-center shadow-sm">
          <h1 className="font-heading text-2xl tracking-tight">Experts</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Sign in to start a chat with a CINEM Pro expert — a CV specialist,
            teacher, business advisor, Urdu letter writer and more.
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
  return <ExpertsGallery userName={user.name} />;
}
