import { AdminBackupButton } from "@/components/admin/admin-backup-button";
import { FoundingForm } from "@/components/admin/panel/founding-form";
import { PanelCard, PanelHeader } from "@/components/admin/panel/panel-ui";
import { adminEmails, getProviderKeysPresent } from "@/lib/admin";
import { foundingSpotsSnapshot } from "@/lib/founding-members";
import { loadAdminPage } from "@/lib/admin-page";

export const dynamic = "force-dynamic";

const KEY_LABELS: { key: "openai" | "anthropic" | "gemini" | "xai"; label: string; env: string }[] = [
  { key: "anthropic", label: "Anthropic", env: "ANTHROPIC_API_KEY" },
  { key: "openai", label: "OpenAI", env: "OPENAI_API_KEY" },
  { key: "gemini", label: "Gemini", env: "GEMINI_API_KEY" },
  { key: "xai", label: "Grok (xAI)", env: "XAI_API_KEY" },
];

export default async function AdminSettingsPage() {
  await loadAdminPage("/admin/settings");
  const emails = adminEmails();
  const founding = await foundingSpotsSnapshot();
  const keys = getProviderKeysPresent();

  return (
    <>
      <PanelHeader
        title="Settings"
        hint="Only settings that are really stored and really take effect — no decorative toggles."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <PanelCard
          title="Who can open this panel"
          hint="The ADMIN_EMAILS allowlist. Anyone else — signed in or not — never sees these pages."
        >
          <ul className="divide-y divide-border">
            {emails.map((email) => (
              <li key={email} className="flex items-center justify-between px-5 py-3 text-sm">
                <span className="font-medium">{email}</span>
                <span className="text-xs text-muted-foreground">Owner / superadmin</span>
              </li>
            ))}
          </ul>
          <p className="border-t border-border px-5 py-3 text-xs leading-5 text-muted-foreground">
            Two addresses are built in (cinemtech@gmail.com, mrosmanyt@gmail.com);
            more can be added with the ADMIN_EMAILS environment variable in
            Vercel. There is no separate admin password — the panel uses your
            normal CINEM Pro sign-in, and only allowlisted accounts pass.
            Signed-in accounts that are not on the list get a 404.
          </p>
        </PanelCard>

        <PanelCard
          title="Founding members"
          hint="Stored in SiteConfig and read by the signup flow on every claim."
        >
          <FoundingForm currentTotal={founding.total} claimed={founding.claimed} />
        </PanelCard>

        <PanelCard
          title="Provider keys on this deployment"
          hint="Presence only — values are never shown. Chat and image generation stay honestly “not configured” for any provider whose key is missing."
        >
          <ul className="divide-y divide-border">
            {KEY_LABELS.map((row) => (
              <li key={row.key} className="flex items-center justify-between px-5 py-3 text-sm">
                <span>
                  <span className="font-medium">{row.label}</span>
                  <span className="block text-xs text-muted-foreground">{row.env}</span>
                </span>
                <span
                  className={
                    keys[row.key]
                      ? "rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400"
                      : "rounded-full bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-600 dark:text-red-400"
                  }
                >
                  {keys[row.key] ? "Present" : "Missing"}
                </span>
              </li>
            ))}
          </ul>
        </PanelCard>

        <PanelCard
          title="Backup & restore"
          hint="Downloads a copy of the production data for your own machine. It is a copy — not a second live database."
        >
          <div className="flex flex-wrap gap-2 px-5 py-4">
            <AdminBackupButton />
            <AdminBackupButton full />
          </div>
        </PanelCard>
      </div>
    </>
  );
}
