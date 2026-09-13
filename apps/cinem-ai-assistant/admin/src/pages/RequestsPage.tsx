import { useState } from "react";
import { Check, X, Mail, KeyRound } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Panel, Button } from "@/components/ui";
import { useAdminStore } from "@/store/useAdminStore";
import { fmtDate } from "@/lib/utils";

export default function RequestsPage() {
  const requests = useAdminStore((s) => s.requests);
  const resolveRequest = useAdminStore((s) => s.resolveRequest);
  const [issued, setIssued] = useState<{ email: string; key: string } | null>(null);

  const approve = async (id: string, email: string) => {
    const lic = await resolveRequest(id, true);
    if (lic) setIssued({ email, key: lic.key });
  };

  return (
    <Panel title={`Registration Requests — ${requests.length} pending`} className="h-full">
      {requests.length === 0 ? (
        <p className="py-10 text-center text-neon-dim">No pending requests. 🎉</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          <AnimatePresence>
            {requests.map((r) => (
              <motion.div
                key={r.id}
                layout exit={{ opacity: 0, scale: 0.95 }}
                className="glass p-4"
              >
                <div className="mb-3">
                  <p className="font-display text-base text-ice">{r.name}</p>
                  <p className="text-xs text-neon-dim">Requested {fmtDate(r.created_at)}</p>
                </div>
                <div className="mb-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                  <span className="text-neon-dim">Email</span><span className="text-ice/85">{r.email}</span>
                  <span className="text-neon-dim">WhatsApp</span><span className="text-ice/85">{r.whatsapp}</span>
                  <span className="text-neon-dim">Country</span><span className="text-ice/85">{r.country}</span>
                </div>
                <div className="flex gap-2">
                  <Button variant="primary" onClick={() => approve(r.id, r.email)} className="flex-1 justify-center">
                    <Check className="size-4" /> Approve & Issue Key
                  </Button>
                  <Button variant="danger" onClick={() => resolveRequest(r.id, false)}>
                    <X className="size-4" /> Decline
                  </Button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Issued-key confirmation */}
      <AnimatePresence>
        {issued && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-void/70 backdrop-blur-sm"
            onClick={() => setIssued(null)}
          >
            <motion.div
              initial={{ scale: 0.94 }} animate={{ scale: 1 }}
              onClick={(e) => e.stopPropagation()}
              className="glass w-[440px] max-w-[90vw] p-6 text-center"
            >
              <KeyRound className="mx-auto mb-3 size-9 text-neon" />
              <h3 className="neon-text font-display text-sm tracking-[0.2em]">LICENSE ISSUED</h3>
              <p className="mt-3 font-mono text-lg text-neon">{issued.key}</p>
              <p className="mt-2 text-sm text-neon-dim">
                Send this key to <span className="text-ice">{issued.email}</span> via email or WhatsApp.
              </p>
              <div className="mt-4 flex justify-center gap-2">
                <Button variant="ghost" onClick={() => navigator.clipboard.writeText(issued.key)}>
                  Copy Key
                </Button>
                <Button
                  variant="primary"
                  onClick={() => window.open(`mailto:${issued.email}?subject=Your Cinem AI Assistant License Key&body=Your license key: ${issued.key}`)}
                >
                  <Mail className="size-4" /> Email Key
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Panel>
  );
}
