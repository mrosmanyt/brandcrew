import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell } from "@/components/marketing/marketing-shell";
import { SiteNav } from "@/components/marketing/site-nav";
import { SiteFooter } from "@/components/marketing/home-sections";
import { CASE_STUDIES } from "@/lib/case-studies";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Case studies",
  description: "How teams use CINEM Pro to run agents, jobs, and routines.",
};

export default function CaseStudiesPage() {
  return (
    <MarketingShell>
      <SiteNav />
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-16">
        <p className="text-sm text-muted-foreground">CINEM · CINEM Pro</p>
        <h1 className="font-heading mt-3 text-3xl tracking-tight md:text-4xl">
          Case studies
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
          Real teams, real jobs. Content below is a placeholder structure —
          client copy lands here as it becomes available.
        </p>
        <div className="mt-12 grid gap-6 sm:grid-cols-2">
          {CASE_STUDIES.map((entry) => (
            <Link
              key={entry.slug}
              href={`/case-studies/${entry.slug}`}
              className="block rounded-xl border border-border p-6 transition hover:border-foreground/30"
            >
              <p className="text-sm text-muted-foreground">{entry.industry}</p>
              <h2 className="font-heading mt-2 text-xl tracking-tight">{entry.client}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{entry.summary}</p>
              <p className="mt-4 text-sm font-medium">{entry.stat}</p>
            </Link>
          ))}
        </div>
      </main>
      <SiteFooter />
    </MarketingShell>
  );
}
