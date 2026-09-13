import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Panel } from "@/components/ui";
import { useAdminStore } from "@/store/useAdminStore";

/** Usage logs & analytics — raw per-command stream with search. */
export default function LogsPage() {
  const logs = useAdminStore((s) => s.logs);
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const query = q.toLowerCase();
    return logs.filter((l) =>
      !query || [l.user_email, l.agent, l.command].some((f) => f?.toLowerCase().includes(query)),
    );
  }, [logs, q]);

  return (
    <Panel
      title={`Usage Logs — ${filtered.length}`}
      className="h-full"
      actions={
        <div className="flex items-center gap-1.5 border border-neon/20 bg-abyss/80 px-2">
          <Search className="size-3.5 text-neon-dim" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter logs…"
            className="w-44 bg-transparent py-1.5 text-sm text-ice outline-none placeholder:text-neon-dim/60"
          />
        </div>
      }
    >
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-neon/15 text-left font-display text-[0.55rem] tracking-[0.15em] text-neon-dim">
            <th className="px-2 py-2">TIME</th>
            <th className="px-2 py-2">USER</th>
            <th className="px-2 py-2">AGENT</th>
            <th className="px-2 py-2">COMMAND</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((l) => (
            <tr key={l.id} className="border-b border-neon/[0.06] hover:bg-neon/[0.03]">
              <td className="px-2 py-2 text-neon-dim">{new Date(l.created_at).toLocaleString()}</td>
              <td className="px-2 py-2 text-ice/70">{l.user_email}</td>
              <td className="px-2 py-2 text-neon">{l.agent}</td>
              <td className="px-2 py-2 text-ice/80">{l.command}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}
