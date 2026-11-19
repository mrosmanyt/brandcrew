import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/marketing/legal-page";
import { COMPANY_SITE, SITE_ORIGIN } from "@/lib/site";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Terms & conditions",
  description:
    "Terms for using CINEM Pro, CINEM's AI chat and image generation service.",
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms & conditions" updated="13 September 2026">
      <p>
        These terms are the agreement between you and <strong>CINEM</strong> for{" "}
        <strong>CINEM Pro</strong> ({" "}
        <Link href={SITE_ORIGIN}>{SITE_ORIGIN.replace("https://", "")}</Link>
        ). Related company site:{" "}
        <a href={COMPANY_SITE} rel="noreferrer" target="_blank">
          cinem.tech
        </a>
        .
      </p>

      <h2>The product</h2>
      <p>
        CINEM Pro is an AI chat and image generation service. You chat with AI
        models and generate images in the studio. AI output can be wrong, and
        you remain responsible for how you use it. CINEM Pro does not send
        email, post to social networks, or publish anything on your behalf.
      </p>

      <h2>Accounts</h2>
      <p>
        You must provide an accurate email. When the project requires email
        confirmation, check your inbox, open the link, and then sign in.
        Password reset email is not in this product yet. Two-factor
        authentication is a follow-up, not a fake UI. You are responsible for
        activity under your session. Do not share your password. Plans (Free,
        Pro, Pro Plus, Ultra) cap seats, tokens, and jobs per hour. When a cap
        is hit, the desk stops — it does not keep spending silently.
      </p>

      <h2>Acceptable use</h2>
      <ul>
        <li>Do not use the desk to spam, phish, or break the law.</li>
        <li>Do not probe other workspaces or attempt to bypass admin controls.</li>
        <li>Do not overload public APIs or abuse checkout and signup endpoints.</li>
      </ul>

      <h2>Your content</h2>
      <p>
        You keep rights to the Brand Kit, jobs, and artifacts you create. You
        grant CINEM a limited license to host and process that content so the
        product can function.
      </p>

      <h2>Availability and liability</h2>
      <p>
        The service is provided as-is. Drafts can be wrong. CINEM is not
        liable for lost profits, indirect damages, or decisions you make from
        drafts. Direct damages are limited to fees you paid for CINEM Pro in
        the three months before the claim.
      </p>

      <h2>Changes</h2>
      <p>
        We may update these terms. Continued use after a posted change means
        you accept the new terms. The date at the top is the latest revision.
      </p>
    </LegalPage>
  );
}
