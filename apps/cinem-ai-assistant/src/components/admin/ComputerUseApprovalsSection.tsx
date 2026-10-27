import { useEffect, useState } from "react";
import { Check, Shield, X } from "lucide-react";
import {
  decideComputerUseApproval,
  listPendingComputerUseApprovals,
  setComputerUseRequiresAdminApproval,
  computerUseRequiresAdminApproval,
  type ComputerUseApprovalRequest,
} from "@/lib/computer-use/admin-approval";

/** Admin panel section — approve risky computer-use sessions. */
export default function ComputerUseApprovalsSection() {
  const [rows, setRows] = useState<ComputerUseApprovalRequest[]>([]);
  const [requireAdmin, setRequireAdmin] = useState(computerUseRequiresAdminApproval());

  const refresh = () => setRows(listPendingComputerUseApprovals());

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
  }, []);

  const decide = (id: string, approve: boolean) => {
    decideComputerUseApproval(id, approve);
    refresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-neon">
          <Shield className="size-4" />
          <span className="font-display text-xs tracking-[0.2em]">COMPUTER-USE APPROVALS</span>
        </div>
        <label className="flex items-center gap-2 text-xs text-neon-dim">
          <input
            type="checkbox"
            checked={requireAdmin}
            onChange={(e) => {
              setRequireAdmin(e.target.checked);
              setComputerUseRequiresAdminApproval(e.target.checked);
            }}
          />
          Require admin before risky sessions
        </label>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-neon-dim">No pending computer-use sessions.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-2 border border-neon/20 bg-abyss/50 p-3"
            >
              <div>
                <p className="text-sm text-ice">{r.task}</p>
                <p className="text-xs text-neon-dim">
                  {r.userName || "device user"} · {new Date(r.requestedAt).toLocaleString()}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => decide(r.id, true)}
                  className="flex items-center gap-1 border border-neon/40 px-2 py-1 text-xs text-neon"
                >
                  <Check className="size-3" /> Approve
                </button>
                <button
                  type="button"
                  onClick={() => decide(r.id, false)}
                  className="flex items-center gap-1 border border-red-400/40 px-2 py-1 text-xs text-red-300"
                >
                  <X className="size-3" /> Reject
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
