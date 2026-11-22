import Link from "next/link";
import {
  ArrowLeft,
  BedDouble,
  Briefcase,
  Building2,
  Camera,
  Coffee,
  Dumbbell,
  Globe,
  Heart,
  HeartPulse,
  History,
  Megaphone,
  MessageSquareText,
  MonitorSmartphone,
  Newspaper,
  Rocket,
  Scale,
  Scissors,
  ShoppingBag,
  Sparkles,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import { SITE_TEMPLATES } from "@/lib/site-builder-pure";

/**
 * Guest view of the Website Builder: a read-only showcase of the real
 * templates and how the builder works, with one sign-in call to action.
 * No fake results — the cards describe the same starting points a
 * signed-in user picks from. Signed-in users never see this; they get
 * <SiteBuilder />.
 */

const TEMPLATE_ICONS: Record<string, LucideIcon> = {
  restaurant: UtensilsCrossed,
  salon: Scissors,
  shop: ShoppingBag,
  hotel: BedDouble,
  portfolio: Briefcase,
  "real-estate": Building2,
  clinic: HeartPulse,
  gym: Dumbbell,
  agency: Megaphone,
  saas: Rocket,
  wedding: Heart,
  blog: Newspaper,
  photography: Camera,
  law: Scale,
  cafe: Coffee,
  blank: Sparkles,
};

const STEPS: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: MessageSquareText,
    title: "Describe it in plain words",
    text: "“A website for my bakery, warm colours, menu and a WhatsApp button.” That's all it takes — or start from a ready template below.",
  },
  {
    icon: MonitorSmartphone,
    title: "Watch it appear, live",
    text: "Your website builds in front of you. Switch between phone and desktop views, scroll it, click it — it's the real page.",
  },
  {
    icon: History,
    title: "Change anything, lose nothing",
    text: "Ask for changes in the chat — colours, prices, a new section. Every version is saved, and any older one comes back with one click.",
  },
];

export function BuilderGuestShowcase() {
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
            <Globe className="size-4" /> Website Builder
          </h1>
        </div>
        <Link
          href="/login"
          className="text-sm text-muted-foreground transition hover:text-foreground"
        >
          Sign in
        </Link>
      </header>

      <main className="mx-auto w-full max-w-4xl px-4 py-10">
        <h2 className="font-heading text-3xl tracking-tight md:text-4xl">
          Your website, built by a conversation
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
          Tell CINEM Pro about your business and it builds a complete one-page
          website — designed to a professional standard, ready to preview on
          phone and desktop, and editable just by asking. Sign in to build
          your first site.
        </p>
        <Link
          href="/signup"
          className="mt-6 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
        >
          <Sparkles className="size-4" /> Start building free
        </Link>

        <div className="mt-12 grid gap-4 sm:grid-cols-3">
          {STEPS.map((step) => (
            <div key={step.title} className="rounded-lg border border-border p-4">
              <step.icon className="size-5 text-muted-foreground" />
              <h3 className="mt-3 text-sm font-semibold">{step.title}</h3>
              <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{step.text}</p>
            </div>
          ))}
        </div>

        <h3 className="mt-12 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          Start from a template
        </h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SITE_TEMPLATES.map((template) => {
            const Icon = TEMPLATE_ICONS[template.id] ?? Sparkles;
            return (
              <div key={template.id} className="rounded-lg border border-border p-4">
                <Icon className="size-5 text-muted-foreground" />
                <h4 className="mt-3 text-sm font-semibold">{template.label}</h4>
                <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
                  {template.blurb}
                </p>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
