"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { BrandKit } from "@/lib/brand-kit";

export function BrandKitForm({
  workspaceId,
  initial,
  workspaceName,
  onSaved,
}: {
  workspaceId: string;
  initial: BrandKit;
  workspaceName?: string;
  onSaved?: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(workspaceName ?? "");
  const [kit, setKit] = useState<BrandKit>(initial);
  const [sampleDraft, setSampleDraft] = useState(initial.samplePosts.join("\n\n"));
  const [forbiddenDraft, setForbiddenDraft] = useState(
    initial.forbiddenWords.join(", "),
  );
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload: BrandKit = {
      ...kit,
      samplePosts: sampleDraft
        .split(/\n\s*\n/)
        .map((s) => s.trim())
        .filter(Boolean),
      forbiddenWords: forbiddenDraft
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    };

    if (workspaceName !== undefined) {
      const named = await fetch(`/api/workspaces/${workspaceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!named.ok) {
        const data = await named.json();
        setSaving(false);
        toast.error(data.error || "Could not rename workspace.");
        return;
      }
    }

    const res = await fetch(`/api/workspaces/${workspaceId}/brand-kit`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      toast.error(data.error || "Could not save Brand Kit.");
      return;
    }
    setKit(payload);
    toast.success("Saved. The next generate will use this Brand Kit.");
    onSaved?.();
    router.refresh();
  }

  return (
    <form onSubmit={save} className="space-y-8">
      {workspaceName !== undefined ? (
        <section className="space-y-3">
          <SectionTitle
            kicker="Workspace"
            title="Name"
            hint="Shown in the sidebar. Does not change the Brand Kit voice."
          />
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </section>
      ) : null}

      <section className="space-y-4">
        <SectionTitle
          kicker="Positioning"
          title="Who you sound like"
          hint="Voice, audience, and offer. Agents read these first."
        />
        <Field label="Website" hint="Omar fetches this for research packs. Public http(s) only.">
          <Input
            value={kit.website ?? ""}
            onChange={(e) => setKit({ ...kit, website: e.target.value })}
            placeholder="https://example.com"
          />
        </Field>
        <Field label="Voice">
          <Textarea
            rows={4}
            value={kit.voice}
            onChange={(e) => setKit({ ...kit, voice: e.target.value })}
          />
        </Field>
        <Field label="Audience">
          <Textarea
            rows={3}
            value={kit.audience}
            onChange={(e) => setKit({ ...kit, audience: e.target.value })}
          />
        </Field>
        <Field label="Offer">
          <Textarea
            rows={3}
            value={kit.offer}
            onChange={(e) => setKit({ ...kit, offer: e.target.value })}
          />
        </Field>
      </section>

      <section className="space-y-4">
        <SectionTitle
          kicker="House style"
          title="Examples and bans"
          hint="Sample posts teach cadence. Forbidden words are hard stops."
        />
        <Field label="Sample posts" hint="Separate examples with a blank line.">
          <Textarea
            rows={6}
            value={sampleDraft}
            onChange={(e) => setSampleDraft(e.target.value)}
          />
        </Field>
        <Field label="Forbidden words" hint="Comma-separated.">
          <Input
            value={forbiddenDraft}
            onChange={(e) => setForbiddenDraft(e.target.value)}
          />
        </Field>
      </section>

      <Button type="submit" disabled={saving}>
        {saving ? "Saving…" : "Save & use in next generate"}
      </Button>
    </form>
  );
}

function SectionTitle({
  kicker,
  title,
  hint,
}: {
  kicker: string;
  title: string;
  hint: string;
}) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
        {kicker}
      </p>
      <h2 className="font-heading mt-1 text-xl">{title}</h2>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {children}
    </div>
  );
}
