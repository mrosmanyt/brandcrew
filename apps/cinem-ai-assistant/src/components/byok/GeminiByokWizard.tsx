import { useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, KeyRound, Loader2, Sparkles } from "lucide-react";
import { useSettingsStore } from "@/store/useSettingsStore";
import { notify } from "@/store/useToastStore";
import { cinemCloudOrigin, readSession } from "@/lib/cinemCloud";

const GEMINI_STUDIO = "https://aistudio.google.com/apikey";

const STEPS = [
  {
    title: "Why BYOK?",
    body: "Cinem AI Assistant routes chat, vision, and multi-layer planning through your Gemini key. Keys stay on-device and sync encrypted to your CINEM account when signed in.",
  },
  {
    title: "Create a key",
    body: "Open Google AI Studio → Sign in → Create API key. Enable YouTube Data API v3 on the same GCP project for richer media search (optional).",
    link: GEMINI_STUDIO,
  },
  {
    title: "Paste & save",
    body: "Paste your AIza… key below. It powers the Assistant, desk BYOK sync, and multi-layer orchestrator planning.",
  },
] as const;

/** Settings wizard — Gemini BYOK setup (extends onboarding pattern). */
export default function GeminiByokWizard() {
  const geminiKey = useSettingsStore((s) => s.geminiKey);
  const update = useSettingsStore((s) => s.update);
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState(geminiKey);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const key = draft.trim();
    if (!key) {
      notify("error", "Paste your Gemini API key.");
      return;
    }
    setBusy(true);
    try {
      await update({ geminiKey: key });
      const session = readSession();
      if (session?.accessToken) {
        await fetch(`${cinemCloudOrigin()}/api/user/byok`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.accessToken}`,
          },
          body: JSON.stringify({ geminiKey: key }),
        });
      }
      notify("success", "Gemini key saved.");
    } catch (e) {
      notify("error", e instanceof Error ? e.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  };

  const cur = STEPS[step];

  return (
    <div className="border border-neon/20 bg-abyss/40 p-4">
      <div className="flex items-center gap-2 text-neon">
        <Sparkles className="size-4" />
        <span className="font-display text-[0.65rem] tracking-[0.2em]">GEMINI BYOK WIZARD</span>
      </div>
      <p className="mt-2 text-xs text-neon-dim">
        Step {step + 1}/{STEPS.length}: {cur.title}
      </p>
      <p className="mt-2 text-sm text-ice/90">{cur.body}</p>
      {"link" in cur && cur.link ? (
        <a
          href={cur.link}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-xs text-neon underline-offset-2 hover:underline"
        >
          Open Google AI Studio <ExternalLink className="size-3" />
        </a>
      ) : null}
      {step === STEPS.length - 1 ? (
        <label className="mt-4 block">
          <span className="panel-title mb-1.5 flex items-center gap-1 text-[0.62rem] text-neon-dim">
            <KeyRound className="size-3" /> Gemini API key
          </span>
          <input
            type="password"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="w-full border border-neon/20 bg-abyss/80 px-3 py-2 text-sm text-ice"
          />
        </label>
      ) : null}
      <div className="mt-4 flex justify-between gap-2">
        <button
          type="button"
          disabled={step === 0}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          className="flex items-center gap-1 border border-neon/30 px-3 py-1.5 text-xs text-neon disabled:opacity-40"
        >
          <ChevronLeft className="size-3" /> Back
        </button>
        {step < STEPS.length - 1 ? (
          <button
            type="button"
            onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
            className="flex items-center gap-1 border border-neon/40 px-3 py-1.5 text-xs text-neon"
          >
            Next <ChevronRight className="size-3" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void save()}
            disabled={busy}
            className="flex items-center gap-1 border border-neon/50 bg-neon/15 px-3 py-1.5 text-xs text-neon disabled:opacity-50"
          >
            {busy ? <Loader2 className="size-3 animate-spin" /> : null}
            Save key
          </button>
        )}
      </div>
    </div>
  );
}
