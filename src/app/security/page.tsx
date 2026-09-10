import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/marketing/legal-page";
import { DATA_PROCESSING_ROWS, GDPR_SUBPROCESSORS } from "@/lib/gdpr";
import { SOC2_CONTROLS, SOC2_STATUS_LABEL, soc2ReadinessSummary } from "@/lib/soc2";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Security",
  description:
    "CINEM Pro security controls, subprocessors, and SOC 2 Type I readiness — not a certification.",
};

const STATUS: Record<string, string> = {
  in_product: "In product",
  documented: "Documented",
  process: "Process",
  not_started: "Not started",
};

export default function SecurityPage() {
  const summary = soc2ReadinessSummary();
  return (
    <LegalPage title="Security" updated="10 September 2026">
      <p>
        <strong>{SOC2_STATUS_LABEL}.</strong> {summary.timelineNote} This page is
        product documentation and an evidence map — not a SOC 2 report and not a
        badge.
      </p>
      <p>
        Related: <Link href="/privacy">Privacy</Link>, <Link href="/dpa">DPA template</Link>,{" "}
        <Link href="/terms">Terms</Link>, repo checklist in{" "}
        <code>docs/security/soc2-readiness.md</code>.
      </p>

      <h2>What leaves the device</h2>
      <ul>
        {DATA_PROCESSING_ROWS.map((row) => (
          <li key={row.category}>
            <strong>{row.category}</strong> ({row.location}
            {row.leavesDevice ? ", leaves device" : ", stays on device"}): {row.purpose}.{" "}
            {row.examples}
          </li>
        ))}
      </ul>

      <h2>Subprocessors</h2>
      <ul>
        {GDPR_SUBPROCESSORS.map((row) => (
          <li key={row.name}>
            <strong>{row.name}</strong> — {row.role}. {row.region}.
          </li>
        ))}
      </ul>

      <h2>Type I readiness controls</h2>
      <p>
        {summary.counts.in_product} in product · {summary.counts.documented} documented ·{" "}
        {summary.counts.process} process · {summary.counts.not_started} not started.
      </p>
      <ul>
        {SOC2_CONTROLS.map((row) => (
          <li key={row.id}>
            <strong>
              {row.id} {row.title}
            </strong>{" "}
            ({STATUS[row.status]}). {row.evidence}
          </li>
        ))}
      </ul>
    </LegalPage>
  );
}
