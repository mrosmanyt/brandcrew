import type { Metadata } from "next";
import Link from "next/link";
import { ConnectorsApp } from "@/components/chat/connectors-app";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Connectors — CINEM Pro",
  description:
    "Connect Gmail, Google Calendar and more to CINEM Pro via Composio OAuth.",
};

export default async function ConnectorsPage() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 text-foreground">
        <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 text-center shadow-sm">
          <h1 className="font-heading text-2xl tracking-tight">Connectors</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Sign in to connect Gmail, Google Calendar and other tools to your
            CINEM Pro workspace.
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
  return <ConnectorsApp userName={user.name} />;
}
