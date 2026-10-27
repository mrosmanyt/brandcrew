import { useState } from "react";
import { KeyRound, Copy, Check, Ban, Plus } from "lucide-react";
import { Panel, StatusBadge, Button } from "@/components/ui";
import { useAdminStore } from "@/store/useAdminStore";
import { fmtDate } from "@/lib/utils";
import type { LicensePlan } from "@/lib/types";

const PLANS: { id: LicensePlan; label: string; price: number; days: number | null }[] = [
  { id: "lifetime", label: "Lifetime (one-time)", price: 199, days: null },
  { id: "yearly", label: "Yearly (subscription)", price: 89, days: 365 },
  { id: "monthly", label: "Monthly (subscription)", price: 12, days: 30 },
];

export default function LicensesPage() {
  const licenses = useAdminStore((s) => s.licenses);
  const generateLicense = useAdminStore((s) => s.generateLicense);
  const revokeLicense = useAdminStore((s) => s.revokeLicense);

  const [plan, setPlan] = useState<LicensePlan>("lifetime");
  const [email, setEmail] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const generate = async () => {
    const def = PLANS.find((p) => p.id === plan)!;
    const lic = await generateLicense(plan, def.price, def.days, email.trim() || undefined);
    setEmail("");
    copy(lic.key);
  };

  const copy = (key: string) => {
    void navigator.clipboard.writeText(key);
    setCopied(key);
    setTimeout(() => setCopied(null), 1600);
  };

  return (
    <div className="grid h-full grid-rows-[auto_1fr] gap-4">
      {/* Generator */}
      <Panel title="License Key Generator">
        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="mb-1 block panel-title !text-[0.55rem] text-neon-dim">PLAN</span>
            <select
              value={plan}
              onChange={(e) => setPlan(e.target.value as LicensePlan)}
              className="border border-neon/20 bg-abyss/80 px-3 py-2 text-sm text-ice outline-none focus:border-neon/50"
            >
              {PLANS.map((p) => (
                <option key={p.id} value={p.id} className="bg-abyss">{p.label} — ${p.price}</option>
              ))}
            </select>
          </label>
          <label className="block flex-1">
            <span className="mb-1 block panel-title !text-[0.55rem] text-neon-dim">ASSIGN TO EMAIL (OPTIONAL)</span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              className="w-full border border-neon/20 bg-abyss/80 px-3 py-2 text-sm text-ice outline-none placeholder:text-neon-dim/50 focus:border-neon/50"
            />
          </label>
          <Button variant="primary" onClick={generate}>
            <Plus className="size-4" /> Generate Key
          </Button>
        </div>
        <p className="mt-2 text-xs text-neon-dim">
          Generated keys are copied to clipboard automatically. Subscription plans set an
          auto-expiry date; lifetime keys never expire. Bound to a device on first activation.
        </p>
      </Panel>

      {/* List */}
      <Panel title={`Licenses — ${licenses.length}`} className="min-h-0">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-neon/15 text-left font-display text-[0.55rem] tracking-[0.15em] text-neon-dim">
                <th className="px-2 py-2">KEY</th>
                <th className="px-2 py-2">PLAN</th>
                <th className="px-2 py-2">ASSIGNED</th>
                <th className="px-2 py-2">PRICE</th>
                <th className="px-2 py-2">STATUS</th>
                <th className="px-2 py-2">EXPIRES</th>
                <th className="px-2 py-2 text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {licenses.map((l) => (
                <tr key={l.id} className="border-b border-neon/[0.06] hover:bg-neon/[0.03]">
                  <td className="px-2 py-2.5">
                    <span className="flex items-center gap-1.5 font-mono text-[0.78rem] text-neon">
                      <KeyRound className="size-3 shrink-0 text-neon-dim" /> {l.key}
                    </span>
                  </td>
                  <td className="px-2 py-2.5 uppercase text-ice/70">{l.plan}</td>
                  <td className="px-2 py-2.5 text-ice/70">{l.user_email ?? "—"}</td>
                  <td className="px-2 py-2.5 text-ice/70">${l.price}</td>
                  <td className="px-2 py-2.5"><StatusBadge status={l.status} /></td>
                  <td className="px-2 py-2.5 text-neon-dim">{l.expires_at ? fmtDate(l.expires_at) : "Never"}</td>
                  <td className="px-2 py-2.5">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => copy(l.key)} title="Copy key"
                        className="border border-neon/20 p-1.5 text-neon-dim hover:border-neon/50 hover:text-neon">
                        {copied === l.key ? <Check className="size-3.5 text-neon" /> : <Copy className="size-3.5" />}
                      </button>
                      {l.status !== "revoked" && (
                        <button onClick={() => revokeLicense(l.id)} title="Revoke"
                          className="border border-neon/20 p-1.5 text-neon-dim hover:border-rose-400/50 hover:text-rose-300">
                          <Ban className="size-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
