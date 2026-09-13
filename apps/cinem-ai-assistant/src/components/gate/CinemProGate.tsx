import { useEffect, useState, type ReactNode } from "react";
import { Loader2, LogIn, Mail } from "lucide-react";
import GateShell from "@/components/license/GateShell";
import { claimBrowserSignIn, signInWithPassword, startBrowserSignIn } from "@/lib/cinemCloud";
import { useCinemCloudStore } from "@/store/useCinemCloudStore";

function SignInScreen() {
  const hydrate = useCinemCloudStore((s) => s.hydrate);
  const error = useCinemCloudStore((s) => s.error);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [waitingBrowser, setWaitingBrowser] = useState(false);

  const browserSignIn = async () => {
    setBusy(true);
    setMessage("");
    try {
      const started = await startBrowserSignIn();
      setWaitingBrowser(true);
      setMessage("Finish sign-in in your browser, then this window unlocks.");
      const deadline = Date.now() + 14 * 60 * 1000;
      while (Date.now() < deadline) {
        const claimed = await claimBrowserSignIn(started.nonce);
        if (claimed !== "pending") {
          await hydrate();
          return;
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
      setMessage("That sign-in link expired. Try again.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not open CINEM Pro sign-in.");
    } finally {
      setBusy(false);
      setWaitingBrowser(false);
    }
  };

  const passwordSignIn = async () => {
    setBusy(true);
    setMessage("");
    try {
      await signInWithPassword(email.trim(), password);
      await hydrate();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <GateShell>
      <h2 className="font-display text-sm font-bold tracking-[0.25em] text-ice">
        SIGN IN WITH CINEM PRO
      </h2>
      <p className="mt-2 text-xs leading-relaxed text-neon-dim">
        Cinem AI Assistant is included with your existing CINEM Pro plan. Sign in with the same
        account you use at app.cinem.tech. Free includes 500 chat/voice turns per month; Pro,
        Pro Plus, and Ultra include the assistant.
      </p>

      <button
        onClick={() => void browserSignIn()}
        disabled={busy}
        className="mt-5 flex w-full items-center justify-center gap-2 border border-neon/50 bg-neon/15 py-2.5 font-display text-[0.65rem] font-bold tracking-[0.25em] text-neon transition-all hover:bg-neon/25 disabled:opacity-50"
      >
        {busy && waitingBrowser ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <LogIn className="size-4" />
        )}
        {waitingBrowser ? "WAITING FOR BROWSER…" : "SIGN IN WITH CINEM PRO"}
      </button>

      <div className="mt-6 space-y-3">
        <p className="font-display text-[0.55rem] tracking-[0.2em] text-neon-dim">
          OR EMAIL + PASSWORD
        </p>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@studio.com"
          className="w-full border border-neon/20 bg-abyss/80 px-3 py-2 text-sm text-ice outline-none placeholder:text-neon-dim/50 focus:border-neon/50"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void passwordSignIn()}
          placeholder="Password"
          className="w-full border border-neon/20 bg-abyss/80 px-3 py-2 text-sm text-ice outline-none placeholder:text-neon-dim/50 focus:border-neon/50"
        />
        <button
          onClick={() => void passwordSignIn()}
          disabled={busy || !email.trim() || !password}
          className="flex w-full items-center justify-center gap-2 border border-neon/30 py-2 font-display text-[0.6rem] font-bold tracking-[0.2em] text-ice transition-colors hover:bg-neon/10 disabled:opacity-50"
        >
          <Mail className="size-3.5" />
          CONTINUE WITH EMAIL
        </button>
      </div>

      {(message || error) && (
        <p className="mt-3 text-xs text-amber-300">{message || error}</p>
      )}
    </GateShell>
  );
}

export default function CinemProGate({ children }: { children: ReactNode }) {
  const phase = useCinemCloudStore((s) => s.phase);
  const hydrate = useCinemCloudStore((s) => s.hydrate);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  if (phase === "checking") {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-3 text-neon-dim">
        <Loader2 className="size-7 animate-spin text-neon" />
        <p className="font-display text-[0.65rem] tracking-[0.3em]">CONNECTING TO CINEM PRO…</p>
      </div>
    );
  }

  if (phase === "signed_out") return <SignInScreen />;
  return <>{children}</>;
}
