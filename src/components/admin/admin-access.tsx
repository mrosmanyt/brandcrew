import type { AdminAccessPayload } from "@/lib/admin";
import { AdminPageFrame } from "@/components/admin/admin-shared";

export function AdminAccess({ data }: { data: AdminAccessPayload }) {
  return (
    <AdminPageFrame
      kicker="Internal Admin HQ"
      title="Access"
      hint="Superadmin is the only role. It comes from ADMIN_EMAILS on Vercel. Founder inboxes cinemtech@gmail.com and mrosmanyt@gmail.com are always included."
    >
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-sm font-medium">Effective admins</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Source: {data.source}. Local part is masked; domain is shown.
        </p>
        <ul className="mt-4 divide-y divide-border text-sm">
          {data.emails.map((row, index) => (
            <li key={`${row.domain}-${index}`} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span className="font-mono text-xs">{row.masked}</span>
              <span className="text-xs text-muted-foreground">
                {row.role}
                {row.isDefault ? " · default founder" : ""} · {row.domain}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6 rounded-2xl border border-border bg-card p-5">
        <h2 className="text-sm font-medium">SSO</h2>
        <p className="mt-2 text-sm text-muted-foreground">{data.sso.note}</p>
      </section>

      <section className="mt-6 rounded-2xl border border-border bg-card p-5">
        <h2 className="text-sm font-medium">Vercel setup</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{data.note}</p>
      </section>
    </AdminPageFrame>
  );
}
