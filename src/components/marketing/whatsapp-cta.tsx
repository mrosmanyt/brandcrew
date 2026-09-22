"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { funnelAnonId, trackFunnelEvent } from "@/lib/funnel-client";

/**
 * Funnel: site visit (tracked by FunnelTrack) -> this WhatsApp click -> a
 * "let sales know" form (creates a PurchaseRequest) -> admin marks approved
 * once the sale closes. WHATSAPP_NUMBER is unset by default — no fabricated
 * phone number; set NEXT_PUBLIC_WHATSAPP_NUMBER to turn the WhatsApp link on.
 */
export function WhatsAppCta() {
  const number = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "";
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  function openWhatsApp() {
    trackFunnelEvent("whatsapp_click");
    if (number) {
      window.open(`https://wa.me/${number}`, "_blank", "noopener,noreferrer");
    }
    setOpen(true);
  }

  async function submitRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Enter your name so sales can follow up.");
      return;
    }
    setBusy(true);
    const res = await fetch("/api/purchase-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), note: note.trim(), anonId: funnelAnonId() }),
    });
    setBusy(false);
    if (!res.ok) {
      toast.error("Could not send that — try WhatsApp directly.");
      return;
    }
    toast.success("Sent — we'll follow up.");
    setName("");
    setNote("");
    setOpen(false);
  }

  return (
    <div className="space-y-3">
      <Button type="button" variant="secondary" onClick={openWhatsApp}>
        Talk to sales on WhatsApp
      </Button>
      {!number ? (
        <p className="text-xs text-muted-foreground">
          (WhatsApp number not configured yet — set NEXT_PUBLIC_WHATSAPP_NUMBER.)
        </p>
      ) : null}
      {open ? (
        <form onSubmit={submitRequest} className="grid gap-2 sm:grid-cols-3">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
          />
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What are you looking for? (optional)"
          />
          <Button type="submit" size="sm" disabled={busy}>
            {busy ? "Sending…" : "Let sales know"}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
