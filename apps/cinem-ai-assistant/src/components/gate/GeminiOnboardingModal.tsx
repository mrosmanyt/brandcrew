import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ExternalLink, KeyRound, Loader2, Sparkles } from "lucide-react";
import { useSettingsStore } from "@/store/useSettingsStore";
import { notify } from "@/store/useToastStore";
import { cinemCloudOrigin, readSession } from "@/lib/cinemCloud";
import GateShell from "@/components/license/GateShell";

const GEMINI_STUDIO = "https://aistudio.google.com/apikey";

async function syncGeminiToCloud(key: string) {
  const session = readSession();
  if (!session?.accessToken) return;
  await fetch(`${cinemCloudOrigin()}/api/user/byok`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.accessToken}`,
    },
    body: JSON.stringify({ geminiKey: key }),
  }).catch(() => undefined);
}

/**
 * Blocking first-run popup when no Gemini key is stored.
 * Same key powers Cinem AI Assistant + desk Gemini features (BYOK sync).
 */
export default function GeminiOnboardingModal() {
  const loaded = useSettingsStore((s) => s.loaded);
  const geminiKey = useSettingsStore((s) => s.geminiKey);
  const update = useSettingsStore((s) => s.update);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const needsKey = loaded && !geminiKey.trim() && !dismissed;

  useEffect(() => {
    if (!loaded || geminiKey.trim()) return;
    void fetch(`${cinemCloudOrigin()}/api/user/byok`, {
      headers: { Authorization: `Bearer ${readSession()?.accessToken || ""}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.byok?.hasGeminiKey) {
          /* Cloud has a key — user can paste locally in Settings; don't auto-import ciphertext. */
        }
      })
      .catch(() => undefined);
  }, [loaded, geminiKey]);

  const save = async () => {
    const key = draft.trim();
    if (!key) {
      notify("error", "Paste your Gemini API key to continue.");
      return;
    }
    setBusy(true);
    try {
      await update({ geminiKey: key });
      await syncGeminiToCloud(key);
      setDismissed(true);
      notify("success", "Gemini key saved — Cinem AI Assistant is ready.");
    } catch (e) {
      notify("error", e instanceof Error ? e.message : "Could not save key.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatePresence>
      {needsKey ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-void/90 p-4 backdrop-blur-sm"
        >
          <GateShell>
            <div className="flex items-center gap-2 text-neon">
              <Sparkles className="size-5" />
              <h2 className="font-display text-sm font-bold tracking-[0.2em]">CONNECT GEMINI</h2>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-neon-dim">
              Cinem AI Assistant uses your Google Gemini key for chat, vision, and YouTube search.
              One key powers the Assistant and CINEM Pro desk features. Stored securely on this
              device and your account — never in git.
            </p>
            <ol className="mt-4 space-y-2 text-xs text-ice/90">
              <li className="flex gap-2">
                <span className="font-display text-neon">1.</span>
                <span>
                  Go to{" "}
                  <a
                    href={GEMINI_STUDIO}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-neon underline-offset-2 hover:underline"
                  >
                    Google AI Studio
                    <ExternalLink className="size-3" />
                  </a>
                </span>
              </li>
              <li className="flex gap-2">
                <span className="font-display text-neon">2.</span>
                <span>Sign in → Create API key</span>
              </li>
              <li className="flex gap-2">
                <span className="font-display text-neon">3.</span>
                <span>Copy → paste below</span>
              </li>
            </ol>
            <p className="mt-3 text-[0.65rem] text-neon-dim/80">
              Tip: enable YouTube Data API v3 on the same GCP project for richer search — still one
              key field only.
            </p>
            <label className="mt-4 block">
              <span className="panel-title mb-1.5 flex items-center gap-1.5 !text-[0.62rem] text-neon-dim">
                <KeyRound className="size-3.5" /> Gemini API key (AIza…)
              </span>
              <input
                type="password"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="AIza…"
                className="w-full border border-neon/20 bg-abyss/80 px-3 py-2 text-sm text-ice outline-none focus:border-neon/50"
                autoComplete="off"
              />
            </label>
            <button
              type="button"
              onClick={() => void save()}
              disabled={busy || !draft.trim()}
              className="mt-5 flex w-full items-center justify-center gap-2 border border-neon/50 bg-neon/15 py-2.5 font-display text-[0.65rem] font-bold tracking-[0.25em] text-neon transition-all hover:bg-neon/25 disabled:opacity-50"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              SAVE &amp; START
            </button>
          </GateShell>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
