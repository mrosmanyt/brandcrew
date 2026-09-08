import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/marketing/legal-page";
import { COMPANY_SITE, SITE_ORIGIN } from "@/lib/site";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Privacy policy",
  description:
    "How CINEM collects and uses data in CINEM Pro — accounts, sessions, workspace content, and optional analytics.",
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy" updated="8 September 2026">
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

      <h2>What we collect</h2>
      <ul>
        <li>Account name and email when you sign up (email/password or Google).</li>
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
        sessionStorage. We do not use advertising cookies. Optional analytics
        scripts load only when an analytics environment variable is set{" "}
        <em>and</em> you accept them in the cookie banner. Your banner choice
        (and desk pane width) may be stored in localStorage on this device — that
        is not a login token.
      </p>

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
