import { useEffect, useState, type ReactNode } from "react";
import {
  Loader2, Send, Hourglass, RefreshCcw, XCircle, KeyRound, Snowflake, Lock,
  MonitorSmartphone, LogIn,
} from "lucide-react";
import { useUserStore } from "@/store/useUserStore";
import { burstConfetti } from "@/lib/confetti";
import GateShell from "@/components/license/GateShell";
import { cn } from "@/lib/utils";

/* ── Shared form bits (same style as the old gate screens) ────────── */

function Field({
  label, value, onChange, placeholder, type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block font-display text-[0.6rem] tracking-[0.2em] text-neon-dim">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-neon/20 bg-abyss/80 px-3 py-2 text-sm text-ice outline-none transition-colors placeholder:text-neon-dim/50 focus:border-neon/50"
      />
    </label>
  );
}

/* ── Registration (first run) ─────────────────────────────────────── */

function RegisterScreen() {
  const register = useUserStore((s) => s.register);
  const busy = useUserStore((s) => s.busy);
  const message = useUserStore((s) => s.message);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [country, setCountry] = useState("");

  return (
    <GateShell>
      <h2 className="font-display text-sm font-bold tracking-[0.25em] text-ice">REGISTRATION</h2>
      <p className="mt-1 text-xs text-neon-dim">
        Request access to Cinem AI Assistant. Your request is stored locally and reviewed by the admin —
        no internet required.
      </p>

      <div className="mt-5 space-y-3">
        <Field label="FULL NAME" value={name} onChange={setName} placeholder="John Carter" />
        <Field label="EMAIL" value={email} onChange={setEmail} placeholder="john@example.com" type="email" />
        <Field label="WHATSAPP" value={whatsapp} onChange={setWhatsapp} placeholder="+92 300 0000000" />
        <Field label="COUNTRY" value={country} onChange={setCountry} placeholder="Pakistan" />
      </div>

      {message && <p className="mt-3 text-xs text-amber-300">{message}</p>}

      <button
        onClick={() => void register({ name, email, whatsapp, country })}
        disabled={busy}
        className="mt-5 flex w-full items-center justify-center gap-2 border border-neon/50 bg-neon/15 py-2.5 font-display text-[0.65rem] font-bold tracking-[0.25em] text-neon transition-all hover:bg-neon/25 disabled:opacity-50"
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        SUBMIT REQUEST
      </button>
    </GateShell>
  );
}

/* ── Pending (waiting for admin approval) ─────────────────────────── */

function PendingScreen() {
  const user = useUserStore((s) => s.user);
  const checkNow = useUserStore((s) => s.checkNow);
  const registerAgain = useUserStore((s) => s.registerAgain);
  const [checking, setChecking] = useState(false);

  const recheck = async () => {
    setChecking(true);
    await checkNow();
    setTimeout(() => setChecking(false), 600);
  };

  return (
    <GateShell>
      <div className="flex flex-col items-center text-center">
        <div className="relative mb-4 flex size-16 items-center justify-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-neon/10 [animation-duration:2.4s]" />
          <span className="absolute inset-1 rounded-full border border-neon/30 animate-pulse" />
          <Hourglass className="size-7 text-neon" />
        </div>

        <h2 className="font-display text-sm font-bold tracking-[0.25em] text-ice">
          AWAITING APPROVAL
        </h2>
        <p className="mt-2 text-sm text-ice/80">Request sent to admin. Waiting for approval.</p>
        {user && (
          <p className="mt-1 text-xs text-neon-dim">
            {user.name} • {user.email}
          </p>
        )}
        <p className="mt-3 text-[0.65rem] leading-relaxed text-neon-dim/80">
          The app unlocks automatically the moment the admin approves your request.
        </p>

        <div className="mt-5 flex w-full gap-2">
          <button
            onClick={() => void recheck()}
            className="flex flex-1 items-center justify-center gap-2 border border-neon/40 py-2 font-display text-[0.6rem] font-bold tracking-[0.2em] text-neon transition-all hover:bg-neon/10"
          >
            <RefreshCcw className={cn("size-3.5", checking && "animate-spin")} /> CHECK STATUS
          </button>
          <button
            onClick={() => void registerAgain()}
            className="border border-neon/15 px-3 py-2 font-display text-[0.6rem] tracking-[0.2em] text-neon-dim transition-colors hover:text-ice"
          >
            EDIT
          </button>
        </div>
      </div>
    </GateShell>
  );
}

/* ── Rejected ─────────────────────────────────────────────────────── */

function RejectedScreen() {
  const user = useUserStore((s) => s.user);
  const registerAgain = useUserStore((s) => s.registerAgain);

  return (
    <GateShell>
      <div className="flex flex-col items-center text-center">
        <XCircle className="mb-3 size-10 text-rose-400" />
        <h2 className="font-display text-sm font-bold tracking-[0.25em] text-ice">
          REQUEST REJECTED
        </h2>
        <p className="mt-2 text-sm text-ice/80">
          Your access request{user ? ` (${user.email})` : ""} was rejected by the admin.
        </p>
        <p className="mt-2 text-xs text-neon-dim">
          If you believe this is a mistake, contact the admin or submit a new request.
        </p>
        <button
          onClick={() => void registerAgain()}
          className="mt-5 w-full border border-neon/50 bg-neon/15 py-2.5 font-display text-[0.65rem] font-bold tracking-[0.25em] text-neon transition-all hover:bg-neon/25"
        >
          REGISTER AGAIN
        </button>
      </div>
    </GateShell>
  );
}

/* ── Frozen (admin disabled login) ────────────────────────────────── */

function FrozenScreen() {
  const user = useUserStore((s) => s.user);

  return (
    <GateShell>
      <div className="flex flex-col items-center text-center">
        <Snowflake className="mb-3 size-10 animate-pulse text-sky-300" />
        <h2 className="font-display text-sm font-bold tracking-[0.25em] text-ice">
          ACCOUNT FROZEN
        </h2>
        <p className="mt-2 text-sm text-ice/80">
          Your account{user ? ` (${user.email})` : ""} has been frozen by the admin.
          Login is disabled until it is unfrozen.
        </p>
        <p className="mt-3 text-[0.65rem] leading-relaxed text-neon-dim/80">
          This screen unlocks automatically the moment the admin unfreezes your account.
        </p>
      </div>
    </GateShell>
  );
}

/* ── Session taken (account logged in on another device) ──────────── */

function SessionScreen() {
  const user = useUserStore((s) => s.user);
  const takeOver = useUserStore((s) => s.takeOver);
  const busy = useUserStore((s) => s.busy);

  return (
    <GateShell>
      <div className="flex flex-col items-center text-center">
        <div className="relative mb-4 flex size-16 items-center justify-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-amber-400/10 [animation-duration:2.4s]" />
          <span className="absolute inset-1 rounded-full border border-amber-300/30 animate-pulse" />
          <MonitorSmartphone className="size-7 text-amber-300" />
        </div>

        <h2 className="font-display text-sm font-bold tracking-[0.25em] text-ice">
          LOGGED IN ELSEWHERE
        </h2>
        <p className="mt-2 text-sm text-ice/80">
          Your account{user ? ` (${user.email})` : ""} was just signed in on another
          device — this session has been signed out automatically.
        </p>
        <p className="mt-2 text-[0.65rem] leading-relaxed text-neon-dim/80">
          Cinem AI Assistant allows only ONE active session per account. Continue here to sign
          the other device out instead.
        </p>

        <button
          onClick={() => void takeOver()}
          disabled={busy}
          className="mt-5 flex w-full items-center justify-center gap-2 border border-neon/50 bg-neon/15 py-2.5 font-display text-[0.65rem] font-bold tracking-[0.25em] text-neon transition-all hover:bg-neon/25 disabled:opacity-50"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}
          USE Cinem AI Assistant HERE
        </button>
      </div>
    </GateShell>
  );
}

/* ── Access password (set / reset by admin) ───────────────────────── */

function PasswordScreen() {
  const submitPassword = useUserStore((s) => s.submitPassword);
  const message = useUserStore((s) => s.message);
  const [pass, setPass] = useState("");

  return (
    <GateShell>
      <div className="flex flex-col items-center text-center">
        <Lock className="mb-3 size-9 text-neon" />
        <h2 className="font-display text-sm font-bold tracking-[0.25em] text-ice">
          ACCESS PASSWORD
        </h2>
        <p className="mt-2 text-xs text-neon-dim">
          The admin set an access password for your account. Enter it once to continue.
        </p>
        <input
          type="password"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submitPassword(pass)}
          placeholder="••••••••"
          className="mt-4 w-full border border-neon/20 bg-abyss/80 px-3 py-2 text-center font-mono text-sm tracking-[0.3em] text-ice outline-none focus:border-neon/50"
        />
        {message && <p className="mt-2 text-xs text-amber-300">{message}</p>}
        <button
          onClick={() => submitPassword(pass)}
          className="mt-4 w-full border border-neon/50 bg-neon/15 py-2.5 font-display text-[0.65rem] font-bold tracking-[0.25em] text-neon transition-all hover:bg-neon/25"
        >
          UNLOCK
        </button>
      </div>
    </GateShell>
  );
}

/* ── Gate ─────────────────────────────────────────────────────────── */

/**
 * Local user gate — fully offline (no Supabase, no internet).
 * Checks the local license status on every app start; renders the full app
 * only for approved users.
 */
export default function LocalGate({ children }: { children: ReactNode }) {
  const phase = useUserStore((s) => s.phase);
  const user = useUserStore((s) => s.user);
  const justUnlocked = useUserStore((s) => s.justUnlocked);
  const clearUnlockFlag = useUserStore((s) => s.clearUnlockFlag);
  const init = useUserStore((s) => s.init);

  useEffect(() => {
    void init();
  }, [init]);

  // Celebrate the moment the admin approves.
  useEffect(() => {
    if (justUnlocked) {
      burstConfetti();
      clearUnlockFlag();
    }
  }, [justUnlocked, clearUnlockFlag]);

  if (phase === "checking") {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-3 text-neon-dim">
        <Loader2 className="size-7 animate-spin text-neon" />
        <p className="font-display text-[0.65rem] tracking-[0.3em]">CHECKING LICENSE…</p>
      </div>
    );
  }
  if (phase === "register") return <RegisterScreen />;
  if (phase === "pending") return <PendingScreen />;
  if (phase === "rejected") return <RejectedScreen />;
  if (phase === "frozen") return <FrozenScreen />;
  if (phase === "password") return <PasswordScreen />;
  if (phase === "session") return <SessionScreen />;

  return (
    <>
      {/* Tiny license badge flash on fresh unlock */}
      {justUnlocked && user?.licenseKey && (
        <div className="pointer-events-none fixed bottom-24 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 border border-neon/50 bg-abyss/95 px-4 py-2 text-neon shadow-[0_0_24px_rgba(var(--glow),0.4)]">
          <KeyRound className="size-4" />
          <span className="font-mono text-xs">{user.licenseKey}</span>
        </div>
      )}
      {children}
    </>
  );
}
