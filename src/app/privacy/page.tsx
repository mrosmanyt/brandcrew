import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/marketing/legal-page";
import { DATA_PROCESSING_ROWS } from "@/lib/gdpr";
import { COMPANY_SITE, SITE_ORIGIN } from "@/lib/site";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Privacy policy",
  description:
    "How CINEM collects and uses data in CINEM Pro — accounts, on-device browse, processors, and optional analytics.",
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy" updated="13 September 2026">
      <p>
        This policy describes how <strong>CINEM</strong> (“we”) handles information when you
        use <strong>CINEM Pro</strong> at{" "}
        <Link href={SITE_ORIGIN}>{SITE_ORIGIN.replace("https://", "")}</Link> and related
        desktop builds. Company site:{" "}
        <a href={COMPANY_SITE} rel="noreferrer" target="_blank">
          cinem.tech
        </a>
        .
      </p>

      <p>
        We protect the data you entrust to CINEM Pro. Agency buyers: see the{" "}
        <Link href="/dpa">DPA template</Link>. Related:{" "}
        <Link href="/terms">Terms</Link>.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          Account name and email when you sign up (email/password or Google). Desktop,
          Android, and the Chrome extension use the same account.
        </li>
        <li>
          Workspace data you create: Brand Kit, agents, jobs, artifacts, and
          marketplace connections.
        </li>
        <li>
          Connection details you add for apps you connect. Those are stored
          securely and are not shown back in the browser.
        </li>
        <li>Usage counters used to enforce plan limits (tokens, jobs, seats).</li>
      </ul>

      <h2>Cookies</h2>
      <p>
        The <code>brandcrew_session</code> cookie is essential. It keeps you
        signed in. We do not use advertising cookies. A checkout pixel may load
        so membership checkout can attribute visits — that is billing, not ads.
        Optional analytics load only if you accept them in the cookie banner.
        Your banner choice may be stored on this device — that is not a login
        token.
      </p>

      <h2>Chrome extension, desktop, and Android</h2>
      <p>
        The Chrome extension, desktop app, and Android app use the same CINEM
        account. Sign-in stays on that device. The extension does not sell
        browsing data.
      </p>

      <h2>What stays on the device vs the server</h2>
      <ul>
        {DATA_PROCESSING_ROWS.map((row) => (
          <li key={row.category}>
            <strong>{row.category}</strong> — {row.location}
            {row.leavesDevice ? " (leaves device)" : " (on device)"}: {row.examples}
          </li>
        ))}
      </ul>

      <h2>Processors</h2>
      <p>
        If you connect Gmail, Slack, or other apps, those services receive
        what you authorize. We do not sell your data.
      </p>

      <h2>Retention</h2>
      <p>
        We keep account and workspace data while the account exists. You can
        ask us to delete an account by contacting CINEM. Backups follow the
        host’s retention window.
      </p>

      <h2>Contact</h2>
      <p>
        Questions:{" "}
        <a href={COMPANY_SITE} rel="noreferrer" target="_blank">
          cinem.tech
        </a>
        .
      </p>
    </LegalPage>
  );
}
