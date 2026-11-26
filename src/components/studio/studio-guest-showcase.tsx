import Link from "next/link";
import {
  ArrowLeft,
  Briefcase,
  GraduationCap,
  History,
  MoonStar,
  MousePointerClick,
  Palette,
  Share2,
  Sparkles,
  Trophy,
  Upload,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { PHOTO_STUDIO_PRESETS } from "@/lib/photo-studio-presets";

/**
 * Guest view of the AI Photo Studio: a read-only showcase of everything
 * the tool does — the full preset gallery, how it works, and one clear
 * sign-up call to action. No fake results: the cards describe the real
 * presets a signed-in user can run, in the same words the studio itself
 * uses. Signed-in users never see this; they get <PhotoStudio />.
 */

const PRESET_ICONS: Record<string, LucideIcon> = {
  "professional-headshot": Briefcase,
  "cricket-fan-poster": Trophy,
  "vintage-yearbook": GraduationCap,
  "cartoon-style": Palette,
  "eid-card": MoonStar,
  "psl-fan-poster": Zap,
  "restore-colorize": History,
};

const STEPS: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: Upload,
    title: "Upload a photo",
    text: "Start with any photo from your phone or computer — a selfie, a family picture, an old print.",
  },
  {
    icon: MousePointerClick,
    title: "Pick a style",
    text: "Seven ready-made styles below. No prompt writing, no settings — one tap restyles your photo.",
  },
  {
    icon: Share2,
    title: "Download & share",
    text: "Save the result, share it with a public link, send it to WhatsApp, or export a branded share card.",
  },
];

function presetModesLabel(modes: readonly string[]): string {
  return modes.includes("generate")
    ? "Restyle a photo · Create from a description"
    : "Restyle a photo";
}

export function StudioGuestShowcase() {
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
            <Sparkles className="size-4" /> AI Photo Studio
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/image-studio"
            className="text-sm text-muted-foreground transition hover:text-foreground"
          >
            Image Studio
          </Link>
          <Link
            href="/login"
            className="text-sm text-muted-foreground transition hover:text-foreground"
          >
            Sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
        <div className="max-w-2xl">
          <h2 className="font-heading text-3xl tracking-tight sm:text-4xl">
            Restyle any photo with AI — in one tap
          </h2>
          <p className="mt-3 text-base leading-7 text-muted-foreground">
            Upload a photo, pick a style, and CINEM Pro restyles it for you: a
            LinkedIn-ready headshot, a cricket fan poster, an Eid greeting
            card, or an old family photo restored and brought back to colour.
            Every result can be downloaded, shared with a link, or sent
            straight to WhatsApp.
          </p>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
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

        <h3 className="mt-12 text-lg font-semibold tracking-tight">The styles</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Every style below runs on the real studio — this is exactly what you
          get with a free account.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PHOTO_STUDIO_PRESETS.map((preset) => {
            const Icon = PRESET_ICONS[preset.id] ?? Sparkles;
            return (
              <div
                key={preset.id}
                className="rounded-xl border border-border bg-card px-4 py-4 shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                      {preset.label}
                      {preset.seasonal ? (
                        <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                          Seasonal
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {preset.blurb}
                    </p>
                  </div>
                </div>
                <p className="mt-3 border-t border-border pt-2.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {presetModesLabel(preset.modes)}
                </p>
              </div>
            );
          })}
        </div>

        <div className="mt-12 rounded-3xl border border-border bg-card p-8 text-center shadow-sm">
          <h3 className="font-heading text-2xl tracking-tight">
            Create your free account to start
          </h3>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            Sign up free and restyle your first photo in under a minute. Your
            photos and results stay in your account, ready to download and
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
        </div>
      </main>
    </div>
  );
}
