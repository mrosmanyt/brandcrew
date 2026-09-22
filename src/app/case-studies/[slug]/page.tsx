import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MarketingShell } from "@/components/marketing/marketing-shell";
import { SiteNav } from "@/components/marketing/site-nav";
import { SiteFooter } from "@/components/marketing/home-sections";
import { CASE_STUDIES, getCaseStudy } from "@/lib/case-studies";

export const dynamic = "force-static";

export function generateStaticParams() {
  return CASE_STUDIES.map((entry) => ({ slug: entry.slug }));
}

export function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Metadata {
  const entry = getCaseStudy(params.slug);
  return {
    title: entry ? `${entry.client} — case study` : "Case study",
    description: entry?.summary,
  };
}

export default function CaseStudyPage({ params }: { params: { slug: string } }) {
  const entry = getCaseStudy(params.slug);
  if (!entry) notFound();

  return (
    <MarketingShell>
      <SiteNav />
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
        <p className="text-sm text-muted-foreground">
          <Link href="/case-studies">Case studies</Link> · {entry.industry}
        </p>
        <h1 className="font-heading mt-3 text-3xl tracking-tight md:text-4xl">
          {entry.client}
        </h1>
        <p className="mt-4 text-base leading-7 text-muted-foreground">{entry.summary}</p>

        <div className="mt-10 space-y-8 text-sm leading-7">
          <section>
            <h2 className="font-heading text-xl tracking-tight">Challenge</h2>
            <p className="mt-3 text-muted-foreground">{entry.challenge}</p>
          </section>
          <section>
            <h2 className="font-heading text-xl tracking-tight">Approach</h2>
            <p className="mt-3 text-muted-foreground">{entry.approach}</p>
          </section>
          <section>
            <h2 className="font-heading text-xl tracking-tight">Results</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-muted-foreground">
              {entry.results.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </section>
          {entry.quote ? (
            <blockquote className="border-l-2 border-border pl-4 text-muted-foreground">
              <p className="italic">&ldquo;{entry.quote.body}&rdquo;</p>
              <footer className="mt-2 text-sm">
                {entry.quote.name} — {entry.quote.title}
              </footer>
            </blockquote>
          ) : null}
        </div>

        <p className="mt-12 text-sm text-muted-foreground">
          <Link href="/case-studies">Back to case studies</Link>
        </p>
      </main>
      <SiteFooter />
    </MarketingShell>
  );
}
