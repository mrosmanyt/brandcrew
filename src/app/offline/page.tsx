import type { Metadata } from "next";
import { PRODUCT_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Offline",
  robots: { index: false, follow: false },
};

/**
 * Offline fallback served by the service worker when a navigation fails
 * without network. Static and public on purpose: it must render with no
 * session and no data so the installed app never shows a dead browser error.
 */
export default function OfflinePage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 py-24 text-center">
      <h1 className="font-heading text-3xl tracking-tight">
        You&apos;re offline
      </h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        {PRODUCT_NAME} needs a connection to chat and generate images. Check
        your network and try again — your chats are saved and will be right
        here when you&apos;re back.
      </p>
      <a
        href="/chat"
        className="mt-8 inline-flex items-center rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
      >
        Try again
      </a>
    </main>
  );
}
