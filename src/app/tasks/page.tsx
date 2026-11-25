import type { Metadata } from "next";
import Link from "next/link";
import { ScheduledTasksApp } from "@/components/chat/scheduled-tasks-app";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Scheduled Tasks — CINEM Pro",
  description:
    "Set up AI tasks that run on a schedule and land as reports in CINEM Pro — daily briefings, weekly research and more.",
};

export default async function ScheduledTasksPage() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 text-foreground">
        <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 text-center shadow-sm">
          <h1 className="font-heading text-2xl tracking-tight">Scheduled Tasks</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Sign in to create AI tasks that run on a schedule and save their
            reports here for you.
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
  return <ScheduledTasksApp userName={user.name} />;
}
