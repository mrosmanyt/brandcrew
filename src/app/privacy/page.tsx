import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/marketing/legal-page";
import { COMPANY_SITE, SITE_ORIGIN } from "@/lib/site";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Privacy policy",
  description:
    "How CINEM protects your account and workspace content in CINEM Pro.",
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy" updated="13 September 2026">
      <p>
        This policy describes how <strong>CINEM</strong> (“we”) handles information when you
        use <strong>CINEM Pro</strong> at{" "}
        <Link href={SITE_ORIGIN}>{SITE_ORIGIN.replace("https://", "")}</Link> and related
        apps. Company site:{" "}
        <a href={COMPANY_SITE} rel="noreferrer" target="_blank">
          cinem.tech
        </a>
        .
      </p>

      <p>
        We protect the data you entrust to CINEM Pro. We do not sell your
        content. Agency buyers: see the <Link href="/dpa">DPA template</Link>.
        Related: <Link href="/terms">Terms</Link>.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>Account name and email when you sign up.</li>
        <li>Workspace content you create (and drafts your agents produce).</li>
        <li>Basic usage so we can apply your plan.</li>
      </ul>

      <h2>Cookies</h2>
      <p>
        An essential cookie keeps you signed in. We do not use advertising
        cookies. A checkout pixel may load so membership checkout can attribute
        visits. Optional analytics load only if you accept them in the cookie
        banner.
      </p>

      <h2>Apps on your devices</h2>
      <p>
        The website, desktop app, Android app, and Chrome extension use the same
        CINEM account. We do not sell browsing data.
      </p>

      <h2>Retention</h2>
      <p>
        We keep account and workspace data while the account exists. You can
        ask us to delete an account by contacting CINEM.
      </p>

      <h2>Contact</h2>
      <p>
        Privacy questions:{" "}
        <a href={COMPANY_SITE} rel="noreferrer" target="_blank">
          cinem.tech
        </a>
        .
      </p>
    </LegalPage>
  );
}
