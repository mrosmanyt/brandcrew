import type { AdminModelsPayload } from "@/lib/admin";
import { AdminPageFrame } from "@/components/admin/admin-shared";

export function AdminModels({ data }: { data: AdminModelsPayload }) {
  const keys = [
    { id: "openai", label: "OpenAI", present: data.keysPresent.openai },
    { id: "anthropic", label: "Anthropic", present: data.keysPresent.anthropic },
    { id: "gemini", label: "Gemini", present: data.keysPresent.gemini },
    { id: "xai", label: "xAI", present: data.keysPresent.xai },
  ];

  return (
    <AdminPageFrame
      kicker="Internal Admin HQ"
      title="Model / cost"
      hint="Display names map to cheap backend ids. Key presence is boolean only — secret values are never loaded here."
    >
      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-sm font-medium">Display → backend</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-5 py-2 font-medium">Display</th>
                <th className="px-3 py-2 font-medium">Catalog</th>
                <th className="px-3 py-2 font-medium">Class</th>
                <th className="px-5 py-2 font-medium">Configured provider id</th>
              </tr>
            </thead>
            <tbody>
              {data.catalog.map((row) => (
                <tr key={row.catalogId} className="border-b border-border last:border-0">
                  <td className="px-5 py-3">{row.displayName}</td>
                  <td className="px-3 py-3 font-mono text-xs">{row.catalogId}</td>
                  <td className="px-3 py-3 capitalize">{row.backendClass}</td>
                  <td className="px-5 py-3 font-mono text-xs">{row.configuredProviderModelId}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="mt-6 grid gap-3 sm:grid-cols-4">
        {keys.map((row) => (
          <article key={row.id} className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">{row.label}</p>
            <p className="mt-1 text-sm font-medium">{row.present ? "Key present" : "Key absent"}</p>
          </article>
        ))}
      </div>

      <section className="mt-6 overflow-hidden rounded-2xl border border-border bg-card">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-sm font-medium">Usage by provider model id</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {data.note} Total UsageEvent tokens: {data.usageEventTokens.toLocaleString()}.
          </p>
        </div>
        {data.usageByProviderModelId.length === 0 ? (
          <p className="px-5 py-4 text-sm text-muted-foreground">No usage events stored.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[32rem] text-left text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="px-5 py-2 font-medium">Display</th>
                  <th className="px-3 py-2 font-medium">providerModelId</th>
                  <th className="px-3 py-2 font-medium">Tokens</th>
                  <th className="px-5 py-2 font-medium">Events</th>
                </tr>
              </thead>
              <tbody>
                {data.usageByProviderModelId.map((row) => (
                  <tr key={row.providerModelId} className="border-b border-border last:border-0">
                    <td className="px-5 py-3">{row.displayName}</td>
                    <td className="px-3 py-3 font-mono text-xs">{row.providerModelId}</td>
                    <td className="px-3 py-3">{row.tokens.toLocaleString()}</td>
                    <td className="px-5 py-3">{row.events.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AdminPageFrame>
  );
}
