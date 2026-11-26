import Link from "next/link";
import {
  ArrowLeft,
  Eraser,
  Images,
  MousePointerClick,
  Share2,
  Sparkles,
  Wand2,
  type LucideIcon,
} from "lucide-react";

/**
 * Guest view of the Image Studio: an honest showcase of what the studio
 * does — describe an image, generate it, keep it in your gallery, then
 * edit it (backgrounds, clean-up, style variants) and share it. No fake
 * results and no working controls: signed-in users get the real studio.
 */

const STEPS: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: MousePointerClick,
    title: "Describe it",
    text: "Type what you want to see — a product shot, a poster, a scene from your imagination — and generate it in one click.",
  },
  {
    icon: Images,
    title: "Your gallery",
    text: "Every image you create is kept in your own studio gallery, ready to open, download and share whenever you come back.",
  },
  {
    icon: Wand2,
    title: "Edit anything",
    text: "Open any image and keep going: remove or change the background, clean it up, or restyle it — just say the change.",
  },
  {
    icon: Share2,
    title: "Share it anywhere",
    text: "Download the image, share it with a public CINEM Pro link, send it to WhatsApp, or export a branded share card.",
  },
];

const EDITS: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: Eraser,
    title: "Background remove & change",
    text: "Strip a busy background away, or drop your subject somewhere new — a studio backdrop, a beach, a city street.",
  },
  {
    icon: Sparkles,
    title: "Clean up & enhance",
    text: "Noise, dull light and distractions cleaned up into a polished, professional-looking image.",
  },
  {
    icon: Wand2,
    title: "Style variants",
    text: "The same image as a cartoon, a vintage yearbook portrait, a cricket poster and more — one tap per variant.",
  },
];

export function ImageStudioGuestShowcase() {
  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <header className="flex h-14 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> Home
          </Link>
          <h1 className="flex items-center gap-2 text-[15px] font-semibold">
            <Sparkles className="size-4" /> Image Studio
          </h1>
        </div>
        <Link
          href="/login"
          className="text-sm text-muted-foreground transition hover:text-foreground"
        >
          Sign in
        </Link>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
        <div className="max-w-2xl">
          <h2 className="font-heading text-3xl tracking-tight sm:text-4xl">
            One studio, only images
          </h2>
          <p className="mt-3 text-base leading-7 text-muted-foreground">
            The Image Studio does one thing: images. Describe what you want,
            generate it, find it in your gallery, then edit and restyle it
            until it is right — no chat, no clutter, nothing else competing
            for your attention.
          </p>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <div key={step.title} className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <step.icon className="size-4" />
                </span>
                <p className="text-sm font-medium">
                  <span className="text-muted-foreground">{index + 1}. </span>
                  {step.title}
                </p>
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.text}</p>
            </div>
          ))}
        </div>

        <h3 className="mt-12 text-lg font-semibold tracking-tight">The edits</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Every edit below runs on the real studio, on any image in your
          gallery — exactly what you get with a free account.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {EDITS.map((edit) => (
            <div
              key={edit.title}
              className="rounded-xl border border-border bg-card px-4 py-4 shadow-sm"
            >
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <edit.icon className="size-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium">{edit.title}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {edit.text}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 rounded-3xl border border-border bg-card p-8 text-center shadow-sm">
          <h3 className="font-heading text-2xl tracking-tight">
            Create your free account to start
          </h3>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            Sign up free and generate your first image in under a minute.
            Your gallery stays in your account, ready to edit, download and
            share.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/signup"
              className="inline-flex h-11 items-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground transition hover:opacity-90"
            >
              Create free account
            </Link>
            <Link
              href="/login"
              className="inline-flex h-11 items-center rounded-full border border-border px-6 text-sm font-medium transition hover:bg-muted/60"
            >
              Sign in
            </Link>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Looking for one-tap photo restyles instead?{" "}
            <Link href="/studio" className="underline underline-offset-2 hover:text-foreground">
              Open the AI Photo Studio
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
