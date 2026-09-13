import { useState } from "react";
import { motion } from "framer-motion";
import { ShieldCheck, Loader2, LogIn } from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";

/** Admin sign-in gate (Supabase Auth) — shown in live mode until authed. */
export default function LoginScreen() {
  const signIn = useAuthStore((s) => s.signIn);
  const error = useAuthStore((s) => s.error);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!email || !password || busy) return;
    setBusy(true);
    await signIn(email.trim(), password);
    setBusy(false);
  };

  return (
    <div className="flex h-screen w-screen items-center justify-center">
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="glass w-[400px] max-w-[90vw] p-8"
      >
        <div className="mb-6 text-center">
          <ShieldCheck className="mx-auto mb-3 size-10 text-neon" />
          <h1 className="neon-text font-display text-lg font-black tracking-[0.3em]">Cinem AI Assistant</h1>
          <p className="font-display text-[0.55rem] tracking-[0.35em] text-neon-dim">ADMIN CONTROL</p>
        </div>

        <div className="space-y-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Admin email"
            className="w-full border border-neon/20 bg-abyss/80 px-3 py-2.5 text-sm text-ice outline-none placeholder:text-neon-dim/60 focus:border-neon/50"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void submit()}
            placeholder="Password"
            className="w-full border border-neon/20 bg-abyss/80 px-3 py-2.5 text-sm text-ice outline-none placeholder:text-neon-dim/60 focus:border-neon/50"
          />

          {error && <p className="text-sm text-rose-300">{error}</p>}

          <button
            onClick={() => void submit()}
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 border border-neon/50 bg-neon/15 py-2.5 font-display text-[0.7rem] font-bold tracking-[0.2em] text-neon transition-colors hover:bg-neon/25 disabled:opacity-50"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}
            SIGN IN
          </button>
        </div>

        <p className="mt-5 text-center text-[0.68rem] leading-relaxed text-neon-dim/70">
          Create an admin account in Supabase → Authentication → Add user,
          then sign in here.
        </p>
      </motion.div>
    </div>
  );
}
