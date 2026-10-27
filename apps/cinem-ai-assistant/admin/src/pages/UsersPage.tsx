import { useMemo, useState } from "react";
import { Search, Snowflake, Sun, Ban, BarChart3, X, UserPlus } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Panel, StatusBadge, Button } from "@/components/ui";
import { useAdminStore } from "@/store/useAdminStore";
import { fmtDate, cn } from "@/lib/utils";
import type { AppUser, UserStatus } from "@/lib/types";

/** Inline modal to create a user directly. */
function AddUserModal({ onClose }: { onClose: () => void }) {
  const createUser = useAdminStore((s) => s.createUser);
  const [f, setF] = useState({ name: "", email: "", whatsapp: "", country: "", password: "" });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF({ ...f, [k]: e.target.value });

  const submit = async () => {
    if (!f.name || !f.email || f.password.length < 6 || busy) return;
    setBusy(true);
    const ok = await createUser({ ...f, email: f.email.trim() });
    setBusy(false);
    if (ok) onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-void/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95 }} animate={{ scale: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="glass w-[420px] max-w-[90vw] p-6"
      >
        <h3 className="mb-1 neon-text font-display text-sm tracking-[0.2em]">ADD USER</h3>
        <p className="mb-4 text-xs text-neon-dim">
          Creates a login account (email + password). The user can sign in immediately.
        </p>
        <div className="space-y-2.5">
          {(["name", "email", "whatsapp", "country", "password"] as const).map((k) => (
            <input
              key={k}
              type={k === "password" ? "password" : "text"}
              value={f[k]}
              onChange={set(k)}
              placeholder={k === "password" ? "Password (min 6 chars)" : k[0].toUpperCase() + k.slice(1)}
              className="w-full border border-neon/20 bg-abyss/80 px-3 py-2 text-sm text-ice outline-none placeholder:text-neon-dim/60 focus:border-neon/50"
            />
          ))}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={() => void submit()} disabled={busy}>
            {busy ? "Creating…" : "Create User"}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

const FILTERS: (UserStatus | "all")[] = ["all", "active", "frozen", "expired", "blacklisted"];

/** Slide-over analytics for a single user. */
function UserAnalytics({ user, onClose }: { user: AppUser; onClose: () => void }) {
  const max = Math.max(1, ...user.top_agents.map((_, i) => user.top_agents.length - i));
  return (
    <motion.div
      initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
      transition={{ type: "spring", damping: 26, stiffness: 240 }}
      className="glass absolute right-0 top-0 z-20 flex h-full w-96 max-w-[80vw] flex-col"
    >
      <header className="flex items-center justify-between border-b border-neon/10 px-4 py-3">
        <h3 className="panel-title">Usage Analytics</h3>
        <button onClick={onClose} className="text-neon-dim hover:text-neon"><X className="size-4" /></button>
      </header>
      <div className="flex-1 space-y-4 overflow-auto p-4">
        <div>
          <p className="neon-text font-display text-lg">{user.name}</p>
          <p className="text-xs text-neon-dim">{user.email}</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="glass p-3">
            <p className="font-display text-[0.55rem] tracking-widest text-neon-dim">COMMANDS USED</p>
            <p className="font-display text-xl text-neon">{user.commands_used.toLocaleString()}</p>
          </div>
          <div className="glass p-3">
            <p className="font-display text-[0.55rem] tracking-widest text-neon-dim">LAST ACTIVE</p>
            <p className="font-display text-base text-ice">{fmtDate(user.last_active)}</p>
          </div>
        </div>
        <div>
          <p className="mb-2 panel-title">Most Used Agents</p>
          {user.top_agents.length ? (
            <div className="space-y-2">
              {user.top_agents.map((a, i) => (
                <div key={a} className="flex items-center gap-2 text-sm">
                  <span className="w-36 shrink-0 truncate text-ice/80">{a}</span>
                  <div className="h-2 flex-1 bg-abyss">
                    <div className="h-full bg-gradient-to-r from-neon-dim to-neon"
                      style={{ width: `${((user.top_agents.length - i) / max) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-neon-dim">No agent activity recorded.</p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
          <span className="text-neon-dim">WhatsApp</span><span className="text-ice/85">{user.whatsapp}</span>
          <span className="text-neon-dim">Country</span><span className="text-ice/85">{user.country}</span>
          <span className="text-neon-dim">Joined</span><span className="text-ice/85">{fmtDate(user.created_at)}</span>
        </div>
      </div>
    </motion.div>
  );
}

export default function UsersPage() {
  const users = useAdminStore((s) => s.users);
  const setUserStatus = useAdminStore((s) => s.setUserStatus);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<UserStatus | "all">("all");
  const [selected, setSelected] = useState<AppUser | null>(null);
  const [adding, setAdding] = useState(false);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return users.filter((u) => {
      const matchQ = !q || [u.name, u.email, u.country, u.whatsapp].some((f) => f?.toLowerCase().includes(q));
      const matchF = filter === "all" || u.status === filter;
      return matchQ && matchF;
    });
  }, [users, query, filter]);

  return (
    <Panel
      title={`Users — ${filtered.length}`}
      className="relative h-full"
      actions={
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 border border-neon/20 bg-abyss/80 px-2">
            <Search className="size-3.5 text-neon-dim" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              className="w-40 bg-transparent py-1.5 text-sm text-ice outline-none placeholder:text-neon-dim/60"
            />
          </div>
          <Button variant="primary" onClick={() => setAdding(true)}>
            <UserPlus className="size-4" /> Add User
          </Button>
        </div>
      }
    >
      {/* Filter chips */}
      <div className="mb-3 flex gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "border px-3 py-1 font-display text-[0.58rem] font-bold tracking-[0.12em] uppercase transition-colors",
              filter === f ? "border-neon/60 bg-neon/15 text-neon" : "border-neon/15 text-neon-dim hover:text-ice",
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-neon/15 text-left font-display text-[0.55rem] tracking-[0.15em] text-neon-dim">
              <th className="px-2 py-2">NAME</th>
              <th className="px-2 py-2">EMAIL</th>
              <th className="px-2 py-2">WHATSAPP</th>
              <th className="px-2 py-2">COUNTRY</th>
              <th className="px-2 py-2">STATUS</th>
              <th className="px-2 py-2">JOINED</th>
              <th className="px-2 py-2">LAST ACTIVE</th>
              <th className="px-2 py-2 text-right">ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id} className="border-b border-neon/[0.06] hover:bg-neon/[0.03]">
                <td className="px-2 py-2.5 font-semibold text-ice/90">{u.name}</td>
                <td className="px-2 py-2.5 text-ice/70">{u.email}</td>
                <td className="px-2 py-2.5 text-ice/70">{u.whatsapp}</td>
                <td className="px-2 py-2.5 text-ice/70">{u.country}</td>
                <td className="px-2 py-2.5"><StatusBadge status={u.status} /></td>
                <td className="px-2 py-2.5 text-neon-dim">{fmtDate(u.created_at)}</td>
                <td className="px-2 py-2.5 text-neon-dim">{fmtDate(u.last_active)}</td>
                <td className="px-2 py-2.5">
                  <div className="flex justify-end gap-1">
                    <button onClick={() => setSelected(u)} title="Analytics"
                      className="border border-neon/20 p-1.5 text-neon-dim hover:border-neon/50 hover:text-neon">
                      <BarChart3 className="size-3.5" />
                    </button>
                    {u.status === "frozen" ? (
                      <button onClick={() => setUserStatus(u.id, "active")} title="Unfreeze"
                        className="border border-neon/20 p-1.5 text-neon-dim hover:border-neon/50 hover:text-neon">
                        <Sun className="size-3.5" />
                      </button>
                    ) : (
                      <button onClick={() => setUserStatus(u.id, "frozen")} title="Freeze"
                        className="border border-neon/20 p-1.5 text-neon-dim hover:border-sky-400/50 hover:text-sky-300">
                        <Snowflake className="size-3.5" />
                      </button>
                    )}
                    <button onClick={() => setUserStatus(u.id, "blacklisted")} title="Blacklist / Suspend"
                      className="border border-neon/20 p-1.5 text-neon-dim hover:border-rose-400/50 hover:text-rose-300">
                      <Ban className="size-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!filtered.length && (
              <tr><td colSpan={8} className="py-8 text-center text-neon-dim">No users match your filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <AnimatePresence>
        {selected && <UserAnalytics user={selected} onClose={() => setSelected(null)} />}
      </AnimatePresence>
      <AnimatePresence>
        {adding && <AddUserModal onClose={() => setAdding(false)} />}
      </AnimatePresence>
    </Panel>
  );
}
