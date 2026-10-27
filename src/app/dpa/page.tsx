import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/marketing/legal-page";
import { DPA_CONTACT_NOTE } from "@/lib/gdpr";
import { COMPANY_SITE, SITE_ORIGIN } from "@/lib/site";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Data processing addendum",
  description: "DPA template for CINEM Pro agency buyers. Not a signed agreement.",
};

export default function DpaPage() {
  return (
    <LegalPage title="Data processing addendum (template)" updated="13 September 2026">
      <p>
        This page is a <strong>starting template</strong> for agency buyers who need a DPA
        under GDPR. It is <strong>not a signed agreement</strong> and not legal advice.{" "}
        {DPA_CONTACT_NOTE} Company:{" "}
        <a href={COMPANY_SITE} rel="noreferrer" target="_blank">
          cinem.tech
        </a>
        . Product:{" "}
        <Link href={SITE_ORIGIN}>{SITE_ORIGIN.replace("https://", "")}</Link>.
      </p>
      <h2>1. Parties</h2>
      <p>
        <strong>Controller:</strong> the agency (or client) that creates a CINEM Pro
        workspace. <strong>Processor:</strong> CINEM, operating CINEM Pro. Where the
        agency processes personal data for its own clients, the agency remains
        controller of that client data unless a separate written appointment says
        otherwise.
      </p>

      <h2>2. What this covers</h2>
      <p>
        CINEM hosts your account and the workspace content you create so you can
        run the desk. We do not sell that content. High-risk sends still wait
        for a person on your team.
      </p>

      <h2>3. What we hold</h2>
      <ul>
        <li>Account name and email.</li>
        <li>Workspace content you create (and drafts you approve or reject).</li>
        <li>Basic usage so we can apply your plan.</li>
      </ul>

      <h2>4. Deletion and requests</h2>
      <p>
        Account deletion is handled by contacting CINEM. We will help with
        reasonable privacy requests about data we actually store.
      </p>

      <h2>5. How to execute</h2>
      <p>
        Email CINEM with the agency legal name, billing contact, and list of
        client workspaces in scope. Until countersigned, this page is
        documentation only. Related: <Link href="/privacy">Privacy</Link>,{" "}
        <Link href="/terms">Terms</Link>.
      </p>
    </LegalPage>
  );
}
