import { useMemo } from "react";
import { Users, UserCheck, DollarSign, Activity } from "lucide-react";
import { motion } from "framer-motion";
import { Panel } from "@/components/ui";
import { useAdminStore, computeStats } from "@/store/useAdminStore";
import { fmtDate } from "@/lib/utils";

function StatCard({ icon: Icon, label, value, accent }: {
  icon: typeof Users; label: string; value: string; accent?: boolean; index?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass flex items-center gap-4 p-5"
    >
      <div className="flex size-12 items-center justify-center border border-neon/30 bg-neon/5 text-neon">
        <Icon className="size-6" />
      </div>
      <div>
        <p className="font-display text-[0.6rem] tracking-[0.2em] text-neon-dim">{label}</p>
        <p className={`font-display text-2xl font-bold ${accent ? "neon-text" : "text-ice"}`}>{value}</p>
      </div>
    </motion.div>
  );
}

/** Simple CSS bar chart of commands-per-agent (no chart lib needed). */
function AgentUsageChart() {
  const logs = useAdminStore((s) => s.logs);
  const counts = logs.reduce<Record<string, number>>((acc, l) => {
    acc[l.agent] = (acc[l.agent] ?? 0) + 1;
    return acc;
  }, {});
  const rows = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 7);
  const max = Math.max(1, ...rows.map(([, c]) => c));

  return (
    <div className="space-y-2.5">
      {rows.map(([agent, count]) => (
        <div key={agent} className="flex items-center gap-3 text-sm">
          <span className="w-40 shrink-0 truncate text-ice/80">{agent}</span>
          <div className="h-2.5 flex-1 overflow-hidden bg-abyss">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(count / max) * 100}%` }}
              transition={{ duration: 0.6 }}
              className="h-full bg-gradient-to-r from-neon-dim to-neon"
            />
          </div>
          <span className="w-8 shrink-0 text-right font-display text-xs text-neon">{count}</span>
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  // Select raw arrays reactively, then derive stats with useMemo.
  // (Never compute a fresh object inside the selector — it loops forever.)
  const users = useAdminStore((s) => s.users);
  const licenses = useAdminStore((s) => s.licenses);
  const allLogs = useAdminStore((s) => s.logs);
  const stats = useMemo(() => computeStats(users, licenses, allLogs), [users, licenses, allLogs]);
  const logs = allLogs.slice(0, 8);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard icon={Users} label="TOTAL USERS" value={String(stats.totalUsers)} />
        <StatCard icon={UserCheck} label="ACTIVE USERS" value={String(stats.activeUsers)} accent />
        <StatCard icon={DollarSign} label="REVENUE" value={`$${stats.revenue.toLocaleString()}`} accent />
        <StatCard icon={Activity} label="COMMANDS TODAY" value={String(stats.commandsToday)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Commands by Agent">
          <AgentUsageChart />
        </Panel>
        <Panel title="Recent Activity">
          <ul className="space-y-2">
            {logs.map((l) => (
              <li key={l.id} className="flex items-center gap-2 text-sm">
                <span className="size-1.5 shrink-0 rounded-full bg-neon dot-active" />
                <span className="min-w-0 flex-1 truncate text-ice/80">
                  <span className="text-neon">{l.agent}</span> — {l.command}
                </span>
                <span className="shrink-0 text-[0.65rem] text-neon-dim">{fmtDate(l.created_at)}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
