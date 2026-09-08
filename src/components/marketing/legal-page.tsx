import Link from "next/link";
import { SiteNav } from "@/components/marketing/site-nav";
import { SiteFooter } from "@/components/marketing/home-sections";
import { MarketingShell } from "@/components/marketing/marketing-shell";

export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <MarketingShell>
      <SiteNav />
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
        <p className="text-sm text-muted-foreground">CINEM · CINEM Pro</p>
        <h1 className="font-heading mt-3 text-3xl tracking-tight md:text-4xl">{title}</h1>
        <p className="mt-3 text-sm text-muted-foreground">Last updated {updated}</p>
        <div className="mt-10 space-y-6 text-sm leading-7 text-foreground [&_a]:underline [&_a]:underline-offset-4 [&_h2]:font-heading [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:tracking-tight [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
          {children}
        </div>
        <p className="mt-12 text-sm text-muted-foreground">
          <Link href="/">Back home</Link>
        </p>
      </main>
      <SiteFooter />
    </MarketingShell>
  );
}
