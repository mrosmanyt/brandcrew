import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ShieldCheck, Loader2, RefreshCcw, Check, X, Trash2, Copy, LogOut, Users, Hourglass,
  KeyRound, Snowflake, Sun, History, Search, LayoutDashboard, ListChecks, Settings,
  AlertTriangle, DollarSign, TerminalSquare, LogIn, Wrench, BadgeCheck, Cloud, HardDrive,
  Activity, WifiOff, BarChart3, Gauge, IndianRupee, Crown,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  listUsers, approveUser, rejectUser, deleteUser, verifyAdmin, setFrozen, bulkSetFrozen,
  bulkDelete, resetPassword, setPaidAmount, updateAdminCredentials, listActivity,
  clearActivity, getUsageSummary, setUserLimits, BACKEND,
  type UserRecord, type ActivityEntry, type ActivityType, type UsageSummary,
} from "@/lib/db";
import { DEFAULT_SOFT_LIMIT_INR, fmtQty } from "@/lib/costModel";
import { cn } from "@/lib/utils";
import ComputerUseApprovalsSection from "@/components/admin/ComputerUseApprovalsSection";

const SESSION_KEY = "cinem-ai-assistant-admin-session";
const POLL_MS = 3000; // real-time: signups appear within ~3 seconds

/** Sci-fi corner-cut (same language as the main Cinem AI Assistant panels). */
const CUT = {
  clipPath:
    "polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)",
} as const;
const CUT_SM = {
  clipPath:
    "polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)",
} as const;

/* ── Helpers ──────────────────────────────────────────────────────── */

type DisplayStatus = "active" | "frozen" | "pending" | "rejected";

function displayStatus(u: UserRecord): DisplayStatus {
  if (u.status === "approved") return u.frozen ? "frozen" : "active";
  return u.status;
}

const STATUS_STYLE: Record<DisplayStatus, { chip: string; dot: string }> = {
  active: { chip: "border-neon/50 bg-neon/10 text-neon", dot: "bg-neon dot-active" },
  frozen: { chip: "border-sky-300/50 bg-sky-400/10 text-sky-300", dot: "bg-sky-300" },
  pending: { chip: "border-amber-300/50 bg-amber-400/10 text-amber-200", dot: "bg-amber-300 animate-pulse" },
  rejected: { chip: "border-rose-400/50 bg-rose-500/10 text-rose-300", dot: "bg-rose-400" },
};

const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleString() : "—");

function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const ACTIVITY_ICON: Record<ActivityType, ReactNode> = {
  command: <TerminalSquare className="size-3.5 text-neon" />,
  login: <LogIn className="size-3.5 text-emerald-300" />,
  admin: <Wrench className="size-3.5 text-amber-300" />,
  system: <BadgeCheck className="size-3.5 text-neon-dim" />,
};

/* ── Ambient backdrop (cyberpunk command-center atmosphere) ────────── */

function Backdrop() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden">
      <div className="absolute -top-32 left-1/4 size-[420px] rounded-full bg-neon/[0.07] blur-[130px]" />
      <div className="absolute -bottom-40 right-1/5 size-[480px] rounded-full bg-cyan-400/[0.05] blur-[150px]" />
      <div className="absolute left-1/2 top-1/2 size-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-neon/[0.04] blur-[100px]" />
      {/* grid lines */}
      <div
        className="absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(var(--glow),0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(var(--glow),0.4) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
    </div>
  );
}

/** Live HH:MM:SS clock for the header. */
function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="font-display text-xs tabular-nums tracking-[0.2em] text-neon/80">
      {now.toLocaleTimeString([], { hour12: false })}
    </span>
  );
}

/** CLOUD ☁ / LOCAL ⛁ backend chip — makes backend mismatches instantly visible. */
function BackendChip() {
  return (
    <span
      title={
        BACKEND === "cloud"
          ? "Connected to Supabase cloud database"
          : "Using the local JSON database (db-server / offline mode)"
      }
      className="flex items-center gap-1.5 border border-neon/30 bg-neon/[0.06] px-2 py-1 font-display text-[0.55rem] font-bold tracking-[0.2em] text-neon"
      style={CUT_SM}
    >
      {BACKEND === "cloud" ? <Cloud className="size-3" /> : <HardDrive className="size-3" />}
      {BACKEND.toUpperCase()} DB
    </span>
  );
}

/* ── Login ────────────────────────────────────────────────────────── */

function AdminLogin({ onAuthed }: { onAuthed: () => void }) {
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      if (await verifyAdmin(user, pass)) {
        sessionStorage.setItem(SESSION_KEY, "1");
        onAuthed();
      } else {
        setError("Invalid admin credentials.");
      }
    } catch (e) {
      setError(`Connection failed: ${e instanceof Error ? e.message : e}`);
    }
    setBusy(false);
  };

  return (
    <div className="relative flex h-screen w-screen items-center justify-center overflow-hidden">
      <Backdrop />
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="glass z-10 w-[400px] max-w-[92vw] p-8"
        style={CUT}
      >
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-full border border-neon/60 bg-abyss/80 text-neon shadow-[0_0_26px_rgba(var(--glow),0.4),inset_0_0_14px_rgba(var(--glow),0.2)]">
            <ShieldCheck className="size-6" />
          </div>
          <h1 className="neon-text font-display text-xl font-black tracking-[0.4em]">Cinem AI Assistant</h1>
          <p className="mt-1 font-display text-[0.55rem] tracking-[0.35em] text-neon-dim">
            ADMIN COMMAND CENTER
          </p>
          <div className="mt-2 flex justify-center"><BackendChip /></div>
        </div>

        <div className="space-y-3">
          <input
            value={user} onChange={(e) => setUser(e.target.value)} placeholder="Username"
            className="w-full border border-neon/20 bg-abyss/80 px-3 py-2.5 text-sm text-ice outline-none transition-colors placeholder:text-neon-dim/50 focus:border-neon/60 focus:shadow-[0_0_14px_rgba(var(--glow),0.15)]"
            style={CUT_SM}
          />
          <input
            type="password" value={pass} onChange={(e) => setPass(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void submit()} placeholder="Password"
            className="w-full border border-neon/20 bg-abyss/80 px-3 py-2.5 text-sm text-ice outline-none transition-colors placeholder:text-neon-dim/50 focus:border-neon/60 focus:shadow-[0_0_14px_rgba(var(--glow),0.15)]"
            style={CUT_SM}
          />
        </div>

        {error && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 text-xs text-rose-300">
            {error}
          </motion.p>
        )}

        <button
          onClick={() => void submit()}
          disabled={busy}
          className="mt-6 flex w-full items-center justify-center gap-2 border border-neon/60 bg-neon/15 py-3 font-display text-[0.65rem] font-bold tracking-[0.3em] text-neon transition-all hover:bg-neon/25 hover:shadow-[0_0_22px_rgba(var(--glow),0.35)] disabled:opacity-50"
          style={CUT_SM}
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
          AUTHENTICATE
        </button>
      </motion.div>
    </div>
  );
}

/* ── Building blocks ──────────────────────────────────────────────── */

function StatCard({
  icon, label, value, accent, index = 0,
}: { icon: ReactNode; label: string; value: string | number; accent?: boolean; index?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className={cn(
        "glass flex items-center gap-3 px-4 py-3.5 transition-shadow hover:shadow-[0_0_20px_rgba(var(--glow),0.18)]",
        accent && "border-neon/40 shadow-[0_0_18px_rgba(var(--glow),0.18)]",
      )}
      style={CUT}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-neon/40 bg-neon/10 text-neon shadow-[inset_0_0_10px_rgba(var(--glow),0.2)]">
        {icon}
      </span>
      <div className="min-w-0">
        {/* value pops on change — the dashboard feels alive */}
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.p
            key={String(value)}
            initial={{ opacity: 0, y: 6, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6 }}
            className="font-display text-xl font-bold leading-none text-ice"
          >
            {value}
          </motion.p>
        </AnimatePresence>
        <p className="mt-1 truncate font-display text-[0.52rem] tracking-[0.22em] text-neon-dim">{label}</p>
      </div>
    </motion.div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="glass max-h-[80vh] w-[580px] max-w-[94vw] overflow-y-auto border-neon/30 p-5 shadow-[0_0_40px_rgba(var(--glow),0.2)]"
        style={CUT}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-[0.7rem] font-bold tracking-[0.25em] text-neon">{title}</h3>
          <button onClick={onClose} className="text-neon-dim transition-colors hover:text-neon">
            <X className="size-4" />
          </button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}

const btn = (variant: "neon" | "amber" | "rose" | "sky" | "emerald" | "ghost") =>
  cn(
    "flex items-center gap-1 border px-2 py-1 font-display text-[0.55rem] font-bold tracking-wider transition-all",
    variant === "neon" && "border-neon/40 bg-neon/10 text-neon hover:bg-neon/20 hover:shadow-[0_0_10px_rgba(var(--glow),0.3)]",
    variant === "amber" && "border-amber-300/40 bg-amber-400/10 text-amber-300 hover:bg-amber-400/20",
    variant === "rose" && "border-rose-400/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20",
    variant === "sky" && "border-sky-300/40 bg-sky-400/10 text-sky-300 hover:bg-sky-400/20",
    variant === "emerald" && "border-emerald-300/40 bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/20",
    variant === "ghost" && "border-neon/15 text-neon-dim hover:text-ice",
  );

/* ── Dashboard tab ────────────────────────────────────────────────── */

function DashboardTab({ users, activity }: { users: UserRecord[]; activity: ActivityEntry[] }) {
  const active = users.filter((u) => displayStatus(u) === "active").length;
  const frozen = users.filter((u) => displayStatus(u) === "frozen").length;
  const pending = users.filter((u) => u.status === "pending").length;
  const revenue = users.reduce((sum, u) => sum + (u.paidAmount ?? 0), 0);

  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  const commandsToday = activity.filter(
    (a) => a.type === "command" && Date.parse(a.at) >= midnight.getTime(),
  ).length;

  const hourAgo = Date.now() - 3600_000;
  const perUser = new Map<string, { name: string; n: number }>();
  for (const a of activity) {
    if (a.type !== "command" || !a.userId || Date.parse(a.at) < hourAgo) continue;
    const cur = perUser.get(a.userId) ?? { name: a.userName ?? a.userId, n: 0 };
    cur.n++;
    perUser.set(a.userId, cur);
  }
  const suspicious = [...perUser.entries()].filter(([, v]) => v.n >= 25).sort((a, b) => b[1].n - a[1].n);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3 xl:grid-cols-6">
        <StatCard index={0} icon={<Users className="size-4" />} label="TOTAL USERS" value={users.length} />
        <StatCard index={1} icon={<ShieldCheck className="size-4" />} label="ACTIVE USERS" value={active} accent />
        <StatCard index={2} icon={<Snowflake className="size-4" />} label="FROZEN USERS" value={frozen} />
        <StatCard index={3} icon={<Hourglass className="size-4" />} label="PENDING REQUESTS" value={pending} />
        <StatCard index={4} icon={<TerminalSquare className="size-4" />} label="COMMANDS TODAY" value={commandsToday} />
        <StatCard index={5} icon={<DollarSign className="size-4" />} label="REVENUE (USD)" value={`$${revenue}`} />
      </div>

      {/* Suspicious activity monitor */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="glass p-4" style={CUT}>
        <p className="mb-2 flex items-center gap-2 font-display text-[0.6rem] font-bold tracking-[0.25em] text-amber-300">
          <AlertTriangle className="size-4" /> SUSPICIOUS ACTIVITY · LAST HOUR
        </p>
        {suspicious.length === 0 ? (
          <p className="flex items-center gap-2 text-xs text-neon-dim">
            <span className="size-1.5 rounded-full bg-neon dot-active" />
            All clear — no unusual command volume detected.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {suspicious.map(([id, v]) => (
              <li key={id} style={CUT_SM}
                className="flex items-center justify-between border border-amber-300/30 bg-amber-400/5 px-3 py-1.5 text-sm">
                <span className="text-ice/90">{v.name}</span>
                <span className="font-display text-xs text-amber-300">{v.n} commands/hr</span>
              </li>
            ))}
          </ul>
        )}
      </motion.div>

      {/* Live activity feed */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}
        className="glass p-4" style={CUT}>
        <p className="mb-2 flex items-center gap-2 font-display text-[0.6rem] font-bold tracking-[0.25em] text-neon">
          <Activity className="size-4" /> LIVE ACTIVITY FEED
        </p>
        <ul className="space-y-1">
          <AnimatePresence initial={false}>
            {activity.slice(0, 10).map((a) => (
              <motion.li
                key={a.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-2 border-b border-neon/[0.06] py-1.5 text-xs"
              >
                {ACTIVITY_ICON[a.type]}
                <span className="min-w-0 flex-1 truncate text-ice/80">
                  {a.userName ? <span className="text-neon/80">{a.userName}: </span> : null}
                  {a.text}
                </span>
                <span className="shrink-0 text-neon-dim">{timeAgo(a.at)}</span>
              </motion.li>
            ))}
          </AnimatePresence>
          {activity.length === 0 && <li className="text-xs text-neon-dim">No activity yet.</li>}
        </ul>
      </motion.div>
    </div>
  );
}

/* ── Users tab (search + filter + bulk + full actions) ────────────── */

type Filter = "all" | DisplayStatus;

function UsersTab({
  users, refresh, pendingOnly = false,
}: { users: UserRecord[]; refresh: () => Promise<void>; pendingOnly?: boolean }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>(pendingOnly ? "pending" : "all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState<string | null>(null);
  const [activityUser, setActivityUser] = useState<UserRecord | null>(null);
  const [userLog, setUserLog] = useState<ActivityEntry[]>([]);
  const [newPass, setNewPass] = useState<{ user: UserRecord; pass: string } | null>(null);

  const visible = useMemo(() => {
    let list = users;
    if (pendingOnly) list = list.filter((u) => u.status === "pending");
    else if (filter !== "all") list = list.filter((u) => displayStatus(u) === filter);
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((u) =>
        [u.name, u.email, u.whatsapp, u.country, u.licenseKey ?? ""].some((f) =>
          f.toLowerCase().includes(q),
        ),
      );
    }
    return list;
  }, [users, query, filter, pendingOnly]);

  const act = async (fn: () => Promise<unknown>) => {
    await fn();
    await refresh();
  };

  const toggleSel = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const allSelected = visible.length > 0 && visible.every((u) => selected.has(u.id));
  const selIds = [...selected].filter((id) => visible.some((u) => u.id === id));

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(text);
      setTimeout(() => setCopied(null), 1500);
    } catch { /* clipboard unavailable */ }
  };

  const openActivity = async (u: UserRecord) => {
    setActivityUser(u);
    setUserLog(await listActivity({ userId: u.id, limit: 50 }));
  };

  const doResetPassword = async (u: UserRecord) => {
    const pass = await resetPassword(u.id);
    if (pass) setNewPass({ user: u, pass });
    await refresh();
  };

  const doSetPayment = async (u: UserRecord) => {
    const raw = window.prompt(`Payment amount (USD) for ${u.name}:`, String(u.paidAmount ?? 0));
    if (raw === null) return;
    await act(() => setPaidAmount(u.id, Number(raw)));
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {/* Toolbar */}
      <div className="glass flex flex-wrap items-center gap-2 px-3 py-2.5" style={CUT}>
        <div
          className="flex min-w-[230px] flex-1 items-center gap-2 border border-neon/15 bg-abyss/70 px-2.5 py-1.5 transition-colors focus-within:border-neon/50"
          style={CUT_SM}
        >
          <Search className="size-3.5 text-neon-dim" />
          <input
            value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, email, WhatsApp, country, key…"
            className="min-w-0 flex-1 bg-transparent text-sm text-ice outline-none placeholder:text-neon-dim/50"
          />
        </div>

        {!pendingOnly &&
          (["all", "active", "frozen", "pending", "rejected"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={CUT_SM}
              className={cn(
                "border px-2.5 py-1 font-display text-[0.55rem] font-bold tracking-[0.15em] transition-all",
                filter === f
                  ? "border-neon/60 bg-neon/15 text-neon shadow-[0_0_10px_rgba(var(--glow),0.25)]"
                  : "border-neon/15 text-neon-dim hover:text-ice",
              )}
            >
              {f.toUpperCase()}
            </button>
          ))}

        <AnimatePresence>
          {selIds.length > 0 && (
            <motion.div
              initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
              className="flex items-center gap-1.5"
            >
              <span className="font-display text-[0.55rem] tracking-wider text-neon-dim">
                {selIds.length} SELECTED →
              </span>
              <button onClick={() => void act(() => bulkSetFrozen(selIds, true))} className={btn("sky")} style={CUT_SM}>
                <Snowflake className="size-3" /> FREEZE
              </button>
              <button onClick={() => void act(() => bulkSetFrozen(selIds, false))} className={btn("neon")} style={CUT_SM}>
                <Sun className="size-3" /> UNFREEZE
              </button>
              <button
                onClick={() =>
                  window.confirm(`Delete ${selIds.length} user(s)? This cannot be undone.`) &&
                  void act(() => bulkDelete(selIds))
                }
                className={btn("rose")} style={CUT_SM}
              >
                <Trash2 className="size-3" /> DELETE
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Table */}
      <div className="glass min-h-0 flex-1 overflow-auto p-3" style={CUT}>
        {visible.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 py-12 text-neon-dim">
            <Users className="size-8 opacity-60" />
            <p className="text-sm">{pendingOnly ? "No pending requests." : "No users match."}</p>
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 z-10 bg-abyss/95 backdrop-blur">
              <tr className="border-b border-neon/15 font-display text-[0.55rem] tracking-[0.18em] text-neon-dim">
                <th className="px-2 py-2">
                  <input
                    type="checkbox" checked={allSelected}
                    onChange={() => setSelected(allSelected ? new Set() : new Set(visible.map((u) => u.id)))}
                    className="accent-neon"
                  />
                </th>
                <th className="px-2 py-2">USER</th>
                <th className="px-2 py-2">WHATSAPP</th>
                <th className="px-2 py-2">COUNTRY</th>
                <th className="px-2 py-2">JOINED</th>
                <th className="px-2 py-2">LAST LOGIN</th>
                <th className="px-2 py-2">STATUS</th>
                <th className="px-2 py-2">LICENSE KEY</th>
                <th className="px-2 py-2 text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence initial={false}>
                {visible.map((u) => {
                  const st = displayStatus(u);
                  return (
                    <motion.tr
                      key={u.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="border-b border-neon/[0.07] transition-colors hover:bg-neon/[0.05]"
                    >
                      <td className="px-2 py-2.5">
                        <input type="checkbox" checked={selected.has(u.id)} onChange={() => toggleSel(u.id)} className="accent-neon" />
                      </td>
                      <td className="px-2 py-2.5">
                        <p className="font-semibold text-ice/90">{u.name}</p>
                        <p className="text-xs text-neon-dim">{u.email}</p>
                        {u.paidAmount ? <p className="text-[0.65rem] text-emerald-300">paid ${u.paidAmount}</p> : null}
                      </td>
                      <td className="px-2 py-2.5 text-ice/75">{u.whatsapp || "—"}</td>
                      <td className="px-2 py-2.5 text-ice/75">{u.country || "—"}</td>
                      <td className="px-2 py-2.5 text-xs text-neon-dim">{fmt(u.requestedAt)}</td>
                      <td className="px-2 py-2.5 text-xs text-neon-dim">{u.lastLogin ? timeAgo(u.lastLogin) : "never"}</td>
                      <td className="px-2 py-2.5">
                        <span
                          style={CUT_SM}
                          className={cn(
                            "inline-flex items-center gap-1.5 border px-2 py-0.5 font-display text-[0.55rem] tracking-[0.15em]",
                            STATUS_STYLE[st].chip,
                          )}
                        >
                          <span className={cn("size-1.5 rounded-full", STATUS_STYLE[st].dot)} />
                          {st.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-2 py-2.5">
                        {u.licenseKey ? (
                          <button
                            onClick={() => void copyText(u.licenseKey!)} title="Copy license key"
                            className="flex items-center gap-1.5 font-mono text-xs text-neon transition-all hover:drop-shadow-[0_0_6px_rgba(var(--glow),0.8)]"
                          >
                            {copied === u.licenseKey ? "Copied!" : u.licenseKey}
                            <Copy className="size-3 opacity-60" />
                          </button>
                        ) : (
                          <span className="text-xs text-neon-dim/50">—</span>
                        )}
                      </td>
                      <td className="px-2 py-2.5">
                        <div className="flex justify-end gap-1">
                          {u.status === "pending" && (
                            <>
                              <button onClick={() => void act(() => approveUser(u.id))}
                                title="Approve — generates license key & activates"
                                className={btn("neon")} style={CUT_SM}>
                                <Check className="size-3" /> APPROVE
                              </button>
                              <button onClick={() => void act(() => rejectUser(u.id))} title="Reject"
                                className={btn("rose")} style={CUT_SM}>
                                <X className="size-3" /> REJECT
                              </button>
                            </>
                          )}
                          {u.status === "approved" && (
                            <button
                              onClick={() => void act(() => setFrozen(u.id, !u.frozen))}
                              title={u.frozen ? "Unfreeze — re-enable login" : "Freeze — disable login"}
                              className={btn(u.frozen ? "neon" : "sky")} style={CUT_SM}
                            >
                              {u.frozen ? <Sun className="size-3" /> : <Snowflake className="size-3" />}
                            </button>
                          )}
                          <button onClick={() => void doResetPassword(u)} title="Reset access password"
                            className={btn("amber")} style={CUT_SM}>
                            <KeyRound className="size-3" />
                          </button>
                          <button onClick={() => void doSetPayment(u)} title="Set payment / revenue"
                            className={btn("emerald")} style={CUT_SM}>
                            <DollarSign className="size-3" />
                          </button>
                          <button onClick={() => void openActivity(u)} title="View activity log (last 50)"
                            className={btn("ghost")} style={CUT_SM}>
                            <History className="size-3" />
                          </button>
                          <button
                            onClick={() =>
                              window.confirm(`Delete ${u.email}? This cannot be undone.`) &&
                              void act(() => deleteUser(u.id))
                            }
                            title="Delete user"
                            className={cn(btn("ghost"), "hover:text-rose-300")} style={CUT_SM}
                          >
                            <Trash2 className="size-3" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            </tbody>
          </table>
        )}
      </div>

      {/* Modals */}
      <AnimatePresence>
        {activityUser && (
          <Modal title={`ACTIVITY — ${activityUser.name.toUpperCase()} · LAST 50`} onClose={() => setActivityUser(null)}>
            {userLog.length === 0 ? (
              <p className="text-sm text-neon-dim">No activity recorded for this user yet.</p>
            ) : (
              <ul className="space-y-1">
                {userLog.map((a) => (
                  <li key={a.id} className="flex items-start gap-2 border-b border-neon/[0.06] py-1.5 text-xs">
                    {ACTIVITY_ICON[a.type]}
                    <span className="min-w-0 flex-1 text-ice/85">{a.text}</span>
                    <span className="shrink-0 text-neon-dim">{fmt(a.at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Modal>
        )}

        {newPass && (
          <Modal title="NEW ACCESS PASSWORD" onClose={() => setNewPass(null)}>
            <p className="text-sm text-ice/85">
              Password for <span className="text-neon">{newPass.user.name}</span> ({newPass.user.email}) has been
              reset. Share it with the user — Cinem AI Assistant will ask for it on their next start.
            </p>
            <div className="mt-3 flex items-center justify-between border border-neon/40 bg-abyss/80 px-4 py-3 shadow-[inset_0_0_14px_rgba(var(--glow),0.1)]" style={CUT_SM}>
              <span className="font-mono text-lg tracking-[0.3em] text-neon drop-shadow-[0_0_8px_rgba(var(--glow),0.6)]">
                {newPass.pass}
              </span>
              <button onClick={() => void copyText(newPass.pass)} className="text-neon-dim hover:text-neon" title="Copy">
                <Copy className="size-4" />
              </button>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Activity tab ─────────────────────────────────────────────────── */

function ActivityTab({ activity, refresh }: { activity: ActivityEntry[]; refresh: () => Promise<void> }) {
  const [type, setType] = useState<"all" | ActivityType>("all");
  const items = type === "all" ? activity : activity.filter((a) => a.type === type);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="glass flex items-center gap-2 px-3 py-2.5" style={CUT}>
        {(["all", "command", "login", "admin"] as const).map((t) => (
          <button
            key={t} onClick={() => setType(t)} style={CUT_SM}
            className={cn(
              "border px-2.5 py-1 font-display text-[0.55rem] font-bold tracking-[0.15em] transition-all",
              type === t
                ? "border-neon/60 bg-neon/15 text-neon shadow-[0_0_10px_rgba(var(--glow),0.25)]"
                : "border-neon/15 text-neon-dim hover:text-ice",
            )}
          >
            {t.toUpperCase()}
          </button>
        ))}
        <span className="ml-auto text-xs text-neon-dim">{items.length} entries</span>
        <button
          onClick={() =>
            window.confirm("Clear the entire activity log?") &&
            void (async () => { await clearActivity(); await refresh(); })()
          }
          className={btn("rose")} style={CUT_SM}
        >
          <Trash2 className="size-3" /> CLEAR LOG
        </button>
      </div>

      <div className="glass min-h-0 flex-1 overflow-y-auto p-4" style={CUT}>
        {items.length === 0 ? (
          <p className="py-10 text-center text-sm text-neon-dim">No activity recorded.</p>
        ) : (
          <ul className="space-y-1">
            {items.map((a, i) => (
              <motion.li
                key={a.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(i * 0.02, 0.4) }}
                className="flex items-start gap-2.5 border-b border-neon/[0.06] py-2 text-sm"
              >
                {ACTIVITY_ICON[a.type]}
                <div className="min-w-0 flex-1">
                  <p className="text-ice/85">
                    {a.userName ? <span className="text-neon/80">{a.userName} — </span> : null}
                    {a.text}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-neon-dim">{fmt(a.at)}</span>
              </motion.li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ── Usage & Billing tab ──────────────────────────────────────────── */

type UsageStatus = "normal" | "high" | "frozen";

function usageStatus(s: UsageSummary): UsageStatus {
  if (s.frozen) return "frozen";
  if (s.estCostInr >= (s.softLimitInr ?? DEFAULT_SOFT_LIMIT_INR)) return "high";
  return "normal";
}

const USAGE_STATUS_STYLE: Record<UsageStatus, string> = {
  normal: "border-neon/50 bg-neon/10 text-neon",
  high: "border-amber-300/50 bg-amber-400/10 text-amber-200",
  frozen: "border-sky-300/50 bg-sky-400/10 text-sky-300",
};

type UsageSort = "cost" | "commands" | "tokens" | "tts";

function UsageTab({ usage, refresh }: { usage: UsageSummary[]; refresh: () => Promise<void> }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | UsageStatus>("all");
  const [sort, setSort] = useState<UsageSort>("cost");

  const act = async (fn: () => Promise<unknown>) => {
    await fn();
    await refresh();
  };

  const doSetLimits = async (s: UsageSummary) => {
    const soft = window.prompt(
      `SOFT limit (₹/month) for ${s.name} — warning threshold (blank = none):`,
      s.softLimitInr != null ? String(s.softLimitInr) : "",
    );
    if (soft === null) return;
    const hard = window.prompt(
      `HARD limit (₹/month) for ${s.name} — AUTO-FREEZES when reached (blank = none):`,
      s.hardLimitInr != null ? String(s.hardLimitInr) : "",
    );
    if (hard === null) return;
    const num = (v: string) => (v.trim() === "" ? null : Math.max(0, Number(v)));
    await act(() => setUserLimits(s.userId, num(soft), num(hard)));
  };

  const visible = useMemo(() => {
    let list = usage;
    if (filter !== "all") list = list.filter((s) => usageStatus(s) === filter);
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((s) => [s.name, s.email].some((f) => f.toLowerCase().includes(q)));
    return [...list].sort((a, b) =>
      sort === "cost" ? b.estCostInr - a.estCostInr
      : sort === "commands" ? b.commands - a.commands
      : sort === "tokens" ? b.geminiIn + b.geminiOut - (a.geminiIn + a.geminiOut)
      : b.ttsChars - a.ttsChars,
    );
  }, [usage, query, filter, sort]);

  const totalCost = usage.reduce((s, u) => s + u.estCostInr, 0);
  const highUsers = usage.filter((s) => usageStatus(s) === "high");
  const top = usage[0];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard index={0} icon={<IndianRupee className="size-4" />} label="EST COST · THIS MONTH"
          value={`₹${totalCost.toFixed(0)}`} accent />
        <StatCard index={1} icon={<Gauge className="size-4" />} label="AVG / USER"
          value={`₹${usage.length ? (totalCost / usage.length).toFixed(0) : 0}`} />
        <StatCard index={2} icon={<AlertTriangle className="size-4" />} label="HIGH USAGE USERS"
          value={highUsers.length} />
        <StatCard index={3} icon={<Crown className="size-4" />} label="TOP SPENDER"
          value={top && top.estCostInr > 0 ? `${top.name.split(" ")[0]} · ₹${top.estCostInr.toFixed(0)}` : "—"} />
      </div>

      {/* Threshold warning banner */}
      <AnimatePresence>
        {highUsers.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            className="flex shrink-0 items-center gap-2 border border-amber-300/40 bg-amber-400/10 px-4 py-2 text-xs text-amber-200" style={CUT_SM}
          >
            <AlertTriangle className="size-3.5 shrink-0" />
            {highUsers.length} user(s) above their usage threshold:{" "}
            {highUsers.slice(0, 4).map((u) => `${u.name} (₹${u.estCostInr.toFixed(0)})`).join(", ")}
            {highUsers.length > 4 ? "…" : ""} — consider limits or freeze.
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toolbar */}
      <div className="glass flex flex-wrap items-center gap-2 px-3 py-2.5" style={CUT}>
        <div className="flex min-w-[200px] flex-1 items-center gap-2 border border-neon/15 bg-abyss/70 px-2.5 py-1.5 focus-within:border-neon/50" style={CUT_SM}>
          <Search className="size-3.5 text-neon-dim" />
          <input
            value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name or email…"
            className="min-w-0 flex-1 bg-transparent text-sm text-ice outline-none placeholder:text-neon-dim/50"
          />
        </div>
        {(["all", "high", "normal", "frozen"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} style={CUT_SM}
            className={cn(
              "border px-2.5 py-1 font-display text-[0.55rem] font-bold tracking-[0.15em] transition-all",
              filter === f ? "border-neon/60 bg-neon/15 text-neon shadow-[0_0_10px_rgba(var(--glow),0.25)]"
                : "border-neon/15 text-neon-dim hover:text-ice",
            )}>
            {f === "high" ? "HIGH USAGE" : f.toUpperCase()}
          </button>
        ))}
        <span className="ml-auto font-display text-[0.55rem] tracking-[0.2em] text-neon-dim">SORT BY</span>
        {(["cost", "commands", "tokens", "tts"] as UsageSort[]).map((s) => (
          <button key={s} onClick={() => setSort(s)} style={CUT_SM}
            className={cn(
              "border px-2 py-1 font-display text-[0.55rem] font-bold tracking-[0.15em]",
              sort === s ? "border-neon/60 bg-neon/15 text-neon" : "border-neon/15 text-neon-dim hover:text-ice",
            )}>
            {s.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="glass min-h-0 flex-1 overflow-auto p-3" style={CUT}>
        {visible.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 py-12 text-neon-dim">
            <BarChart3 className="size-8 opacity-60" />
            <p className="text-sm">No usage recorded this month.</p>
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 z-10 bg-abyss/95 backdrop-blur">
              <tr className="border-b border-neon/15 font-display text-[0.55rem] tracking-[0.18em] text-neon-dim">
                <th className="px-2 py-2">USER</th>
                <th className="px-2 py-2">COMMANDS</th>
                <th className="px-2 py-2">GEMINI TOKENS</th>
                <th className="px-2 py-2">ELEVENLABS</th>
                <th className="px-2 py-2">VISION · WEB · AGENTS</th>
                <th className="px-2 py-2">EST COST</th>
                <th className="px-2 py-2">LIMITS ₹</th>
                <th className="px-2 py-2">LAST ACTIVE</th>
                <th className="px-2 py-2">STATUS</th>
                <th className="px-2 py-2 text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((s) => {
                const st = usageStatus(s);
                return (
                  <tr key={s.userId} className="border-b border-neon/[0.07] transition-colors hover:bg-neon/[0.05]">
                    <td className="px-2 py-2.5">
                      <p className="font-semibold text-ice/90">{s.name}</p>
                      <p className="text-xs text-neon-dim">{s.email}</p>
                    </td>
                    <td className="px-2 py-2.5 tabular-nums text-ice/85">{s.commands}</td>
                    <td className="px-2 py-2.5 tabular-nums text-ice/85">
                      {fmtQty(s.geminiIn + s.geminiOut)}
                      <span className="ml-1 text-[0.65rem] text-neon-dim">
                        ({fmtQty(s.geminiIn)} in / {fmtQty(s.geminiOut)} out)
                      </span>
                    </td>
                    <td className="px-2 py-2.5 tabular-nums text-ice/85">{fmtQty(s.ttsChars)} chars</td>
                    <td className="px-2 py-2.5 tabular-nums text-neon-dim">
                      {s.vision} · {s.browser} · {s.agents}
                    </td>
                    <td className="px-2 py-2.5">
                      <span className={cn(
                        "font-display text-sm font-bold tabular-nums",
                        st === "high" ? "text-amber-300" : "text-neon",
                      )}>
                        ₹{s.estCostInr.toFixed(s.estCostInr >= 10 ? 0 : 2)}
                      </span>
                    </td>
                    <td className="px-2 py-2.5 text-xs tabular-nums text-neon-dim">
                      {s.softLimitInr ?? "—"} / {s.hardLimitInr ?? "—"}
                    </td>
                    <td className="px-2 py-2.5 text-xs text-neon-dim">
                      {s.lastActive ? timeAgo(s.lastActive) : "never"}
                    </td>
                    <td className="px-2 py-2.5">
                      <span style={CUT_SM} className={cn(
                        "inline-flex items-center gap-1.5 border px-2 py-0.5 font-display text-[0.55rem] tracking-[0.15em]",
                        USAGE_STATUS_STYLE[st],
                      )}>
                        {st === "high" ? "HIGH USAGE" : st.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-2 py-2.5">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => void doSetLimits(s)} title="Set soft/hard ₹ limits"
                          className={btn("amber")} style={CUT_SM}>
                          <Gauge className="size-3" /> LIMITS
                        </button>
                        <button
                          onClick={() => void act(() => setFrozen(s.userId, !s.frozen))}
                          title={s.frozen ? "Unfreeze" : "Freeze this user now"}
                          className={btn(s.frozen ? "neon" : "sky")} style={CUT_SM}
                        >
                          {s.frozen ? <Sun className="size-3" /> : <Snowflake className="size-3" />}
                          {s.frozen ? "UNFREEZE" : "FREEZE"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <p className="shrink-0 text-[0.6rem] leading-relaxed text-neon-dim/70">
        Est. cost = Gemini 2.5 Flash ($0.30/M in · $2.50/M out) + ElevenLabs ($0.165/1k chars) × ₹88/$.
        Month-to-date. Hard limits auto-freeze the account the moment they're crossed.
      </p>
    </div>
  );
}

/* ── Settings tab ─────────────────────────────────────────────────── */

function SettingsTab() {
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [saved, setSaved] = useState(false);

  const save = async () => {
    if (!user.trim() && !pass) return;
    await updateAdminCredentials(user, pass);
    setSaved(true);
    setUser("");
    setPass("");
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="max-w-xl space-y-4">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass p-5" style={CUT}>
        <p className="mb-3 font-display text-[0.6rem] font-bold tracking-[0.25em] text-neon">ADMIN CREDENTIALS</p>
        <div className="space-y-3">
          <input
            value={user} onChange={(e) => setUser(e.target.value)}
            placeholder="New username (leave blank to keep)" style={CUT_SM}
            className="w-full border border-neon/20 bg-abyss/80 px-3 py-2 text-sm text-ice outline-none transition-colors placeholder:text-neon-dim/50 focus:border-neon/60"
          />
          <input
            type="password" value={pass} onChange={(e) => setPass(e.target.value)}
            placeholder="New password (leave blank to keep)" style={CUT_SM}
            className="w-full border border-neon/20 bg-abyss/80 px-3 py-2 text-sm text-ice outline-none transition-colors placeholder:text-neon-dim/50 focus:border-neon/60"
          />
          <button
            onClick={() => void save()} style={CUT_SM}
            className="border border-neon/50 bg-neon/15 px-4 py-2 font-display text-[0.6rem] font-bold tracking-[0.2em] text-neon transition-all hover:bg-neon/25 hover:shadow-[0_0_16px_rgba(var(--glow),0.3)]"
          >
            {saved ? "SAVED ✓" : "SAVE CREDENTIALS"}
          </button>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
        className="glass p-5 text-xs leading-relaxed text-neon-dim" style={CUT}>
        <p className="mb-2 flex items-center gap-2 font-display text-[0.6rem] font-bold tracking-[0.25em] text-neon">
          {BACKEND === "cloud" ? <Cloud className="size-3.5" /> : <HardDrive className="size-3.5" />} STORAGE — {BACKEND.toUpperCase()}
        </p>
        {BACKEND === "cloud" ? (
          <>Users, licenses and activity live in your Supabase project (all access via locked-down
          RPCs — the anon key cannot touch tables directly). Blank out the keys in <span className="font-mono text-ice/80">.env</span> and
          rebuild to switch to the 100% offline local database.</>
        ) : (
          <>All data lives locally in <span className="font-mono text-ice/80">~/.cinem-ai-assistant/cinem-ai-assistant-localdb.json</span> via
          the db-server (port 1430). No cloud, no internet required. Back up that file to back up your user base.</>
        )}
      </motion.div>
    </div>
  );
}

/* ── Shell (header + tabs + data + connection state) ──────────────── */

type Tab = "dashboard" | "users" | "pending" | "usage" | "activity" | "computer_use" | "settings";

const TABS: { id: Tab; label: string; icon: ReactNode }[] = [
  { id: "dashboard", label: "DASHBOARD", icon: <LayoutDashboard className="size-3.5" /> },
  { id: "users", label: "ALL USERS", icon: <Users className="size-3.5" /> },
  { id: "pending", label: "PENDING REQUESTS", icon: <ListChecks className="size-3.5" /> },
  { id: "usage", label: "USAGE & BILLING", icon: <BarChart3 className="size-3.5" /> },
  { id: "activity", label: "ACTIVITY LOG", icon: <History className="size-3.5" /> },
  { id: "computer_use", label: "COMPUTER USE", icon: <ShieldCheck className="size-3.5" /> },
  { id: "settings", label: "SETTINGS", icon: <Settings className="size-3.5" /> },
];

function Shell({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [usage, setUsage] = useState<UsageSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [connError, setConnError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [u, a, us] = await Promise.all([
        listUsers(),
        listActivity({ limit: 500 }),
        getUsageSummary(),
      ]);
      console.log(
        "[ADMIN] Pending requests loaded:",
        u.filter((x) => x.status === "pending").map((x) => ({ name: x.name, email: x.email })),
        `(total users: ${u.length}, backend: ${BACKEND})`,
      );
      setUsers(u);
      setActivity(a);
      setUsage(us);
      setConnError(null);
      setLoading(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[ADMIN] refresh failed:", msg);
      // Bad/expired admin credentials → force a clean re-login instead of
      // silently showing stale data.
      if (/invalid admin credentials|session expired/i.test(msg)) {
        sessionStorage.removeItem(SESSION_KEY);
        sessionStorage.removeItem("cinem-ai-assistant-admin-cred");
        onLogout();
        return;
      }
      setConnError(msg);
      setLoading(false);
    }
  }, [onLogout]);

  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(t);
  }, [refresh]);

  const pendingCount = users.filter((u) => u.status === "pending").length;

  return (
    <div className="relative flex h-screen w-screen flex-col gap-3 overflow-hidden p-4">
      <Backdrop />

      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}
        className="glass z-10 flex shrink-0 items-center justify-between px-5 py-3" style={CUT}
      >
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-full border border-neon/60 bg-abyss/80 text-neon shadow-[0_0_18px_rgba(var(--glow),0.35),inset_0_0_10px_rgba(var(--glow),0.2)]">
            <ShieldCheck className="size-5" />
          </div>
          <div>
            <h1 className="neon-text font-display text-base font-black tracking-[0.35em]">Cinem AI Assistant ADMIN</h1>
            <p className="font-display text-[0.5rem] tracking-[0.3em] text-neon-dim">
              COMMAND CENTER · USER MANAGEMENT
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <BackendChip />
          <span className="flex items-center gap-1.5 font-display text-[0.55rem] tracking-[0.2em] text-neon-dim">
            <span className={cn("size-1.5 rounded-full", connError ? "bg-rose-400 animate-pulse" : "bg-neon dot-active")} />
            {connError ? "LINK DOWN" : "LIVE · 3s SYNC"}
          </span>
          <Clock />
          <button onClick={() => void refresh()} title="Refresh now"
            className="glass flex size-9 items-center justify-center text-neon-dim transition-all hover:text-neon hover:shadow-[0_0_12px_rgba(var(--glow),0.3)]" style={CUT_SM}>
            <RefreshCcw className="size-4" />
          </button>
          <button onClick={onLogout} title="Log out"
            className="glass flex size-9 items-center justify-center text-neon-dim transition-colors hover:text-rose-300" style={CUT_SM}>
            <LogOut className="size-4" />
          </button>
        </div>
      </motion.header>

      {/* Connection error banner */}
      <AnimatePresence>
        {connError && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            className="z-10 flex shrink-0 items-center gap-2 border border-rose-400/40 bg-rose-500/10 px-4 py-2 text-xs text-rose-300" style={CUT_SM}
          >
            <WifiOff className="size-3.5 shrink-0" />
            Database unreachable: {connError} — retrying every 3s…
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tabs */}
      <nav className="z-10 flex shrink-0 gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={CUT_SM}
            className={cn(
              "glass relative flex items-center gap-2 px-4 py-2 font-display text-[0.58rem] font-bold tracking-[0.18em] transition-all",
              tab === t.id
                ? "border-neon/50 text-neon shadow-[0_0_18px_rgba(var(--glow),0.25)]"
                : "text-neon-dim hover:text-ice",
            )}
          >
            {t.icon}
            {t.label}
            {t.id === "pending" && pendingCount > 0 && (
              <motion.span
                key={pendingCount}
                initial={{ scale: 0.6 }} animate={{ scale: 1 }}
                className="rounded-full border border-amber-300/50 bg-amber-400/15 px-1.5 text-[0.55rem] text-amber-200 shadow-[0_0_8px_rgba(251,191,36,0.4)]"
              >
                {pendingCount}
              </motion.span>
            )}
            {tab === t.id && (
              <motion.span layoutId="tab-glow" className="absolute inset-x-2 -bottom-px h-px bg-neon shadow-[0_0_8px_rgba(var(--glow),0.9)]" />
            )}
          </button>
        ))}
      </nav>

      {/* Content */}
      <main className="z-10 flex min-h-0 flex-1 flex-col overflow-y-auto">
        {loading ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-neon-dim">
            <Loader2 className="size-7 animate-spin text-neon" />
            <p className="font-display text-[0.6rem] tracking-[0.3em]">SYNCING DATABASE…</p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
              className="flex min-h-0 flex-1 flex-col"
            >
              {tab === "dashboard" ? (
                <DashboardTab users={users} activity={activity} />
              ) : tab === "users" ? (
                <UsersTab users={users} refresh={refresh} />
              ) : tab === "pending" ? (
                <UsersTab users={users} refresh={refresh} pendingOnly />
              ) : tab === "usage" ? (
                <UsageTab usage={usage} refresh={refresh} />
              ) : tab === "activity" ? (
                <ActivityTab activity={activity} refresh={refresh} />
              ) : tab === "computer_use" ? (
                <ComputerUseApprovalsSection />
              ) : (
                <SettingsTab />
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </main>

      <p className="z-10 shrink-0 text-center font-display text-[0.5rem] tracking-[0.25em] text-neon-dim/60">
        {BACKEND === "cloud"
          ? "CONNECTED TO SUPABASE CLOUD — RPC-LOCKED, RLS-SECURED"
          : "DATA STORED LOCALLY IN ~/.cinem-ai-assistant/cinem-ai-assistant-localdb.json — NO CLOUD REQUIRED"}
      </p>
    </div>
  );
}

/* ── Panel root ───────────────────────────────────────────────────── */

/** Cinem AI Assistant Admin Command Center — /admin (served by db-server on :1430). */
export default function AdminPanel() {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem(SESSION_KEY) === "1");

  if (!authed) return <AdminLogin onAuthed={() => setAuthed(true)} />;
  return (
    <Shell
      onLogout={() => {
        sessionStorage.removeItem(SESSION_KEY);
        setAuthed(false);
      }}
    />
  );
}
