import { useEffect, useState } from "react";
import {
  LayoutDashboard, Users, KeyRound, ScrollText, Loader2, LogOut,
} from "lucide-react";
import { IS_DEMO } from "@/lib/supabase";
import { useAdminStore } from "@/store/useAdminStore";
import { useAuthStore } from "@/store/useAuthStore";
import { cn } from "@/lib/utils";
import Dashboard from "@/pages/Dashboard";
import UsersPage from "@/pages/UsersPage";
import LicensesPage from "@/pages/LicensesPage";
import LogsPage from "@/pages/LogsPage";
import LoginScreen from "@/pages/LoginScreen";

type Page = "dashboard" | "users" | "licenses" | "logs";

const NAV: { id: Page; label: string; icon: typeof Users }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "users", label: "Users", icon: Users },
  { id: "licenses", label: "Licenses", icon: KeyRound },
  { id: "logs", label: "Usage Logs", icon: ScrollText },
];

export default function App() {
  const [page, setPage] = useState<Page>("dashboard");
  const load = useAdminStore((s) => s.load);
  const loading = useAdminStore((s) => s.loading);

  const error = useAdminStore((s) => s.error);
  const clearError = useAdminStore((s) => s.clearError);
  const authReady = useAuthStore((s) => s.ready);
  const authed = useAuthStore((s) => s.authed);
  const adminEmail = useAuthStore((s) => s.email);
  const initAuth = useAuthStore((s) => s.init);
  const signOut = useAuthStore((s) => s.signOut);

  // Check session first; only load data once authenticated.
  useEffect(() => { void initAuth(); }, [initAuth]);
  useEffect(() => { if (authed) void load(); }, [authed, load]);

  if (!authReady) {
    return (
      <div className="flex h-screen items-center justify-center gap-2 text-neon-dim">
        <Loader2 className="size-5 animate-spin" /> Connecting…
      </div>
    );
  }
  if (!authed) return <LoginScreen />;

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="flex w-60 shrink-0 flex-col gap-4 p-4">
        <div className="px-2">
          <h1 className="neon-text font-display text-lg font-black tracking-[0.3em]">Cinem AI Assistant</h1>
          <p className="font-display text-[0.55rem] tracking-[0.35em] text-neon-dim">ADMIN CONTROL</p>
        </div>

        <nav className="flex flex-col gap-1">
          {NAV.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setPage(id)}
              className={cn(
                "flex items-center gap-3 border px-3 py-2.5 text-sm transition-colors",
                page === id
                  ? "border-neon/50 bg-neon/10 text-neon"
                  : "border-transparent text-ice/70 hover:bg-neon/5 hover:text-ice",
              )}
            >
              <Icon className="size-4" />
              <span className="font-display text-[0.7rem] font-bold tracking-[0.12em]">{label.toUpperCase()}</span>
            </button>
          ))}
        </nav>

        <div className="mt-auto space-y-2 px-2">
          <div className="flex items-center gap-2 text-[0.6rem] tracking-[0.15em] text-neon-dim">
            <span className={cn("size-1.5 rounded-full", IS_DEMO ? "bg-amber-400" : "bg-neon dot-active")} />
            {IS_DEMO ? "DEMO MODE — no DB" : "SUPABASE CONNECTED"}
          </div>
          {!IS_DEMO && (
            <button
              onClick={() => void signOut()}
              className="flex w-full items-center gap-2 border border-neon/15 px-2 py-1.5 text-[0.62rem] text-neon-dim transition-colors hover:border-rose-400/40 hover:text-rose-300"
              title={adminEmail ?? "Sign out"}
            >
              <LogOut className="size-3.5" />
              <span className="min-w-0 flex-1 truncate text-left">{adminEmail ?? "Sign out"}</span>
            </button>
          )}
        </div>
      </aside>

      {/* Main */}
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden p-4 pl-0">
        {error && (
          <div className="mb-3 flex items-center justify-between border border-rose-400/40 bg-rose-500/10 px-4 py-2 text-sm text-rose-200">
            <span className="min-w-0 truncate">{error}</span>
            <button onClick={clearError} className="ml-3 shrink-0 text-rose-300 hover:text-rose-100">✕</button>
          </div>
        )}
        {loading ? (
          <div className="flex h-full items-center justify-center gap-2 text-neon-dim">
            <Loader2 className="size-5 animate-spin" /> Loading control center…
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-auto">
            {page === "dashboard" && <Dashboard />}
            {page === "users" && <UsersPage />}
            {page === "licenses" && <LicensesPage />}
            {page === "logs" && <LogsPage />}
          </div>
        )}
      </main>
    </div>
  );
}
