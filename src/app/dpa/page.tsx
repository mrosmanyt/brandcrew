import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/marketing/legal-page";
import { DPA_CONTACT_NOTE } from "@/lib/gdpr";
import { COMPANY_SITE, SITE_ORIGIN } from "@/lib/site";
import { SOC2_STATUS_LABEL } from "@/lib/soc2";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Data processing addendum",
  description:
    "DPA template for CINEM Pro agency buyers — processors, subprocessors, and what stays on-device.",
};

export default function DpaPage() {
  return (
    <LegalPage title="Data processing addendum (template)" updated="10 September 2026">
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
      <p>
        <strong>{SOC2_STATUS_LABEL}.</strong> Do not treat this template as a SOC 2
        report.
      </p>

      <h2>1. Parties</h2>
      <p>
        <strong>Controller:</strong> the agency (or client) that creates a CINEM Pro
        workspace. <strong>Processor:</strong> CINEM, operating CINEM Pro. Where the
        agency processes personal data for its own clients, the agency remains
        controller of that client data unless a separate written appointment says
        otherwise.
      </p>

      <h2>2. Subject matter</h2>
      <p>
        Hosting of workspace content (accounts, Brand Kit, jobs, artifacts, learning
        memory, plugin metadata) so the desk can run supervised agents. High-risk
        sends still wait for a human approver.
      </p>

      <h2>3. Categories of data</h2>
      <ul>
        <li>Account identifiers (name, email).</li>
        <li>Workspace content the customer types or the agent drafts.</li>
        <li>Optional plugin tokens (encrypted) and Composio connected-account ids.</li>
        <li>Usage counters (tokens/credits, jobs, seats).</li>
        <li>Audit rows (who approved what, device pairing events).</li>
      </ul>

      <h2>4. What stays on the device</h2>
      <p>
        When <strong>On-device Chrome</strong> is paired, page interaction (CDP click /
        type / snapshot) runs on the customer machine. The server receives tool
        results the job needs — not a full browser profile or password store. Cloud
        browse is a fallback for public allowlisted URLs when no device is paired.
        See the processing table on{" "}
        <Link href="/privacy">Privacy</Link>.
      </p>

      <h2>5. Subprocessors</h2>
      <p>
        Listed on <Link href="/security">Security</Link> (Vercel, Postgres host, optional
        LLM providers, Composio, OAuth apps the customer connects, Whop/Stripe).
        CINEM does not sell workspace content.
      </p>

      <h2>6. Customer instructions</h2>
      <p>
        The processor processes workspace data to provide the product: store it,
        generate drafts via configured model providers, and execute tools the
        customer approves. The customer is responsible for lawful outreach and for
        not uploading special-category data unless a written addendum covers it.
      </p>

      <h2>7. Security measures</h2>
      <ul>
        <li>HttpOnly session cookie; workspace membership and RBAC.</li>
        <li>Encrypted plugin secrets; env-only <code>COMPOSIO_API_KEY</code>.</li>
        <li>Write-gate and role-based approvals; client-named email always gated.</li>
        <li>Untrusted page wrap and domain allowlist.</li>
        <li>Append-only audit with hash-chained export for later evidence.</li>
      </ul>

      <h2>8. International transfers</h2>
      <p>
        Hosting and model providers may process data outside the EEA. Customers
        should review those providers&apos; transfer mechanisms. This template does
        not invent SCCs in the product UI.
      </p>

      <h2>9. Deletion and assistance</h2>
      <p>
        Account deletion is handled by contacting CINEM. Backups follow the host
        retention window. CINEM will assist with reasonable data-subject requests
        that depend on data we actually store — we cannot invent mailbox contents
        that never left the customer&apos;s device.
      </p>

      <h2>10. How to execute</h2>
      <p>
        Email CINEM with the agency legal name, billing contact, and list of client
        workspaces in scope. Until countersigned, this page is documentation only.
        Related: <Link href="/privacy">Privacy</Link>, <Link href="/terms">Terms</Link>,{" "}
        <Link href="/security">Security</Link>.
      </p>
    </LegalPage>
  );
}
