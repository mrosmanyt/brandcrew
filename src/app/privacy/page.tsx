import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/marketing/legal-page";
import { DATA_PROCESSING_ROWS } from "@/lib/gdpr";
import { COMPANY_SITE, SITE_ORIGIN } from "@/lib/site";
import { SOC2_STATUS_LABEL } from "@/lib/soc2";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Privacy policy",
  description:
    "How CINEM collects and uses data in CINEM Pro — accounts, on-device browse, processors, and optional analytics.",
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy" updated="10 September 2026">
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
        Agency buyers: see the <Link href="/dpa">DPA template</Link> and{" "}
        <Link href="/security">Security</Link>. <strong>{SOC2_STATUS_LABEL}.</strong>
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
          Plugin secrets you paste (API keys, OAuth tokens). Those are encrypted
          with the server session secret and are not returned to the browser.
        </li>
        <li>Usage counters used to enforce plan limits (tokens, jobs, seats).</li>
      </ul>

      <h2>Cookies</h2>
      <p>
        The <code>brandcrew_session</code> cookie is essential. It is httpOnly,
        SameSite=Lax, and Secure in production (and on Vercel). It keeps you
        signed in. The session JWT is never written to localStorage or
        sessionStorage. We do not use advertising cookies. A Whop tracking pixel
        loads in the document head on every page (t.whop.tw, CINEM Tech business{" "}
        <code>biz_VrtL8S4duREQg4</code>) so membership checkout can attribute
        visits — that is billing, not ads, and it is not gated by the cookie
        banner. Optional analytics scripts load only when an analytics
        environment variable is set <em>and</em> you accept them in the cookie
        banner. Your banner choice (and desk pane width) may be stored in
        localStorage on this device — that is not a login token.
      </p>

      <h2>Chrome extension, desktop, and Android</h2>
      <p>
        The Chrome extension stores only the desk origin and a device token in{" "}
        <code>chrome.storage.local</code> after you Sign in with CINEM (or paste a
        pairing code). It does not sell browsing data. Desktop and Android store a
        refresh token in the OS secure store (or Electron userData) so the same
        account opens Mission Control. Access JWTs are the same shape as the web
        session cookie; they are not written to web localStorage.
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
        Hosting is on Vercel. Postgres (Neon or similar) stores accounts and
        workspace rows. If you connect Gmail, Slack, or other plugins, those
        providers receive the OAuth tokens you authorize. If LLM keys are
        configured on the server, job text is sent to the selected model
        provider (OpenAI, Anthropic, Google, or xAI) to produce drafts. We do
        not sell your data.
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
