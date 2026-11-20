import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CINEM_APP_ICON_SRC } from "@/lib/cinem-mark";
import { getSharedImage } from "@/lib/image-share";
import { siteOrigin } from "@/lib/site";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const shared = await getSharedImage(token);
  if (!shared) {
    return { title: "Shared image — CINEM Pro" };
  }
  return {
    title: "Shared image — CINEM Pro",
    description: shared.prompt
      ? `Made with CINEM Pro: ${shared.prompt.slice(0, 140)}`
      : "An image made with CINEM Pro.",
    openGraph: {
      title: "Shared image — CINEM Pro",
      description: "Made with CINEM Pro — AI chat and image generation.",
      images: [{ url: `/api/share/image/${token}/raw` }],
    },
  };
}

export default async function SharedImagePage({ params }: Props) {
  const { token } = await params;
  const shared = await getSharedImage(token);
  if (!shared) notFound();

  const pageUrl = `${siteOrigin()}/share/image/${token}`;
  const imageSrc = shared.mediaUrl || `/api/share/image/${token}/raw`;
  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(
    `Made with CINEM Pro: ${pageUrl}`,
  )}`;

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <header className="flex h-14 items-center justify-between border-b border-border px-4">
        <span className="flex items-center gap-2 text-[15px] font-semibold">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={CINEM_APP_ICON_SRC} alt="" className="size-7 rounded-md" />
          CINEM Pro
        </span>
        <Link
          href="https://app.cinem.tech"
          className="text-sm text-muted-foreground transition hover:text-foreground"
        >
          app.cinem.tech
        </Link>
      </header>

      <main className="mx-auto w-full max-w-2xl px-4 py-8">
        <figure className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
          {/* Shared, runtime-generated image — next/image cannot optimize it. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageSrc}
            alt={shared.prompt || "Image shared from CINEM Pro"}
            className="w-full bg-muted/30 object-contain"
          />
          {shared.prompt ? (
            <figcaption className="px-5 py-4 text-sm leading-6 text-muted-foreground">
              {shared.prompt}
            </figcaption>
          ) : null}
        </figure>

        <p className="mt-5 text-center text-sm font-medium">Made with CINEM Pro</p>
        <p className="mt-1 text-center text-sm text-muted-foreground">
          Created in the CINEM Pro AI Photo Studio.
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <a
            href="https://app.cinem.tech"
            className="inline-flex h-10 items-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            Make your own in CINEM Pro
          </a>
          <a
            href={whatsappHref}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 items-center rounded-full border border-border px-5 text-sm font-medium transition hover:bg-muted"
          >
            Share on WhatsApp
          </a>
        </div>
      </main>
    </div>
  );
}
