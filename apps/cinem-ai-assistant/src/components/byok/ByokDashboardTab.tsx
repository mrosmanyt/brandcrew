import { useEffect, useState } from "react";
import { Gauge, KeyRound, Loader2, Save } from "lucide-react";
import { useSettingsStore } from "@/store/useSettingsStore";
import { cinemCloudOrigin, readSession } from "@/lib/cinemCloud";
import { notify } from "@/store/useToastStore";

type ByokSnapshot = {
  hasGeminiKey: boolean;
  hasDeepgramKey: boolean;
  geminiTokensUsed: number;
  deepgramCharsUsed: number;
  spendCapUsd: number;
  estimatedSpendUsd: number;
  spendPercent: number;
  atCap: boolean;
};

export default function ByokDashboardTab() {
  const local = useSettingsStore();
  const [gemini, setGemini] = useState(local.geminiKey);
  const [deepgram, setDeepgram] = useState(local.deepgramApiKey);
  const [cap, setCap] = useState(25);
  const [cloud, setCloud] = useState<ByokSnapshot | null>(null);
  const [busy, setBusy] = useState(false);

  const loadCloud = async () => {
    const session = readSession();
    if (!session?.accessToken) return;
    const res = await fetch(`${cinemCloudOrigin()}/api/user/byok`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    });
    if (!res.ok) return;
    const data = await res.json();
    if (data.byok) {
      setCloud(data.byok as ByokSnapshot);
      setCap(data.byok.spendCapUsd ?? 25);
    }
  };

  useEffect(() => {
    void loadCloud();
  }, []);

  const save = async () => {
    setBusy(true);
    try {
      await local.update({
        geminiKey: gemini.trim(),
        deepgramApiKey: deepgram.trim(),
      });
      const session = readSession();
      if (session?.accessToken) {
        await fetch(`${cinemCloudOrigin()}/api/user/byok`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.accessToken}`,
          },
          body: JSON.stringify({
            geminiKey: gemini.trim(),
            deepgramKey: deepgram.trim(),
            spendCapUsd: cap,
          }),
        });
        await loadCloud();
      }
      notify("success", "BYOK keys saved.");
    } catch (e) {
      notify("error", e instanceof Error ? e.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  };

  const pct = cloud?.spendPercent ?? 0;

  return (
    <div className="space-y-4">
      <p className="text-xs text-neon-dim">
        Bring your own Gemini + Deepgram keys. Usage meter estimates spend from token/character counters.
      </p>
      <div className="border border-neon/20 bg-abyss/50 p-3">
        <div className="mb-2 flex items-center gap-2 font-display text-[0.6rem] tracking-[0.2em] text-neon">
          <Gauge className="size-3.5" /> MONTHLY SPEND
        </div>
        <div className="h-2 overflow-hidden rounded bg-abyss">
          <div
            className="h-full bg-neon transition-all"
            style={{ width: `${Math.min(100, pct)}%` }}
          />
        </div>
        <p className="mt-2 text-[0.68rem] text-neon-dim">
          ~${(cloud?.estimatedSpendUsd ?? 0).toFixed(2)} / ${cap} cap
          {cloud?.atCap ? " — at cap, review usage" : ""}
        </p>
      </div>
      <label className="block">
        <span className="panel-title mb-1.5 flex items-center gap-1 text-[0.62rem] text-neon-dim">
          <KeyRound className="size-3" /> Gemini
        </span>
        <input
          type="password"
          value={gemini}
          onChange={(e) => setGemini(e.target.value)}
          className="w-full border border-neon/20 bg-abyss/80 px-3 py-2 text-sm text-ice"
        />
      </label>
      <label className="block">
        <span className="panel-title mb-1.5 text-[0.62rem] text-neon-dim">Deepgram</span>
        <input
          type="password"
          value={deepgram}
          onChange={(e) => setDeepgram(e.target.value)}
          className="w-full border border-neon/20 bg-abyss/80 px-3 py-2 text-sm text-ice"
        />
      </label>
      <label className="block">
        <span className="panel-title mb-1.5 text-[0.62rem] text-neon-dim">Spend cap (USD)</span>
        <input
          type="number"
          min={1}
          max={500}
          value={cap}
          onChange={(e) => setCap(Number(e.target.value))}
          className="w-full border border-neon/20 bg-abyss/80 px-3 py-2 text-sm text-ice"
        />
      </label>
      <button
        type="button"
        onClick={() => void save()}
        disabled={busy}
        className="glass flex items-center gap-2 px-4 py-2 text-sm text-neon hover:bg-neon/10 disabled:opacity-50"
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
        Save BYOK
      </button>
    </div>
  );
}
