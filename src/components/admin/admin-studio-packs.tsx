"use client";

import { useState } from "react";
import { toast } from "sonner";
import type {
  AdminStudioPackRow,
  AdminStudioPacksPayload,
} from "@/lib/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AdminPageFrame,
  fetchAdminJson,
  postAdmin,
} from "@/components/admin/admin-shared";

type PresetForm = {
  id: string;
  label: string;
  blurb: string;
  edit: boolean;
  generate: boolean;
  editPrompt: string;
  generateSuffix: string;
};

type PackForm = {
  id: string | null;
  slug: string;
  name: string;
  description: string;
  startsAt: string;
  endsAt: string;
  active: boolean;
  sortOrder: string;
  presets: PresetForm[];
};

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function blankPreset(): PresetForm {
  return {
    id: "",
    label: "",
    blurb: "",
    edit: true,
    generate: true,
    editPrompt: "",
    generateSuffix: "",
  };
}

function blankForm(): PackForm {
  return {
    id: null,
    slug: "",
    name: "",
    description: "",
    startsAt: "",
    endsAt: "",
    active: true,
    sortOrder: "30",
    presets: [blankPreset()],
  };
}

function formFromRow(row: AdminStudioPackRow): PackForm {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    startsAt: toLocalInput(row.startsAt),
    endsAt: toLocalInput(row.endsAt),
    active: row.active,
    sortOrder: String(row.sortOrder),
    presets: row.presets.map((preset) => ({
      id: preset.id,
      label: preset.label,
      blurb: preset.blurb,
      edit: preset.modes.includes("edit"),
      generate: preset.modes.includes("generate"),
      editPrompt: preset.editPrompt,
      generateSuffix: preset.generateSuffix,
    })),
  };
}

function packStatus(row: AdminStudioPackRow): string {
  if (!row.active) return "Off";
  const now = Date.now();
  if (row.startsAt && new Date(row.startsAt).getTime() > now) return "Scheduled";
  if (row.endsAt && new Date(row.endsAt).getTime() < now) return "Ended";
  return "Live now";
}

function windowLabel(row: AdminStudioPackRow): string {
  const start = row.startsAt ? new Date(row.startsAt).toLocaleString() : "always";
  const end = row.endsAt ? new Date(row.endsAt).toLocaleString() : "no end";
  return `${start} → ${end}`;
}

export function AdminStudioPacks({
  initial,
}: {
  initial: AdminStudioPacksPayload;
}) {
  const [data, setData] = useState(initial);
  const [form, setForm] = useState<PackForm | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  async function refresh() {
    setData(
      await fetchAdminJson<AdminStudioPacksPayload>(
        "/api/admin?section=studiopacks",
      ),
    );
  }

  function patchForm(patch: Partial<PackForm>) {
    setForm((current) => (current ? { ...current, ...patch } : current));
  }

  function patchPreset(index: number, patch: Partial<PresetForm>) {
    setForm((current) => {
      if (!current) return current;
      const presets = current.presets.map((preset, i) =>
        i === index ? { ...preset, ...patch } : preset,
      );
      return { ...current, presets };
    });
  }

  async function save() {
    if (!form) return;
    const presets = form.presets.map((preset) => ({
      id: preset.id.trim(),
      label: preset.label.trim(),
      blurb: preset.blurb.trim(),
      modes: [
        ...(preset.edit ? ["edit"] : []),
        ...(preset.generate ? ["generate"] : []),
      ],
      editPrompt: preset.editPrompt,
      generateSuffix: preset.generateSuffix,
    }));
    if (presets.some((preset) => preset.modes.length === 0)) {
      toast.error("Every preset needs at least one mode (Edit or Create).");
      return;
    }
    setBusy(true);
    try {
      await postAdmin({
        action: "studio_pack_save",
        ...(form.id ? { packId: form.id } : {}),
        pack: {
          slug: form.slug,
          name: form.name,
          description: form.description,
          startsAt: fromLocalInput(form.startsAt),
          endsAt: fromLocalInput(form.endsAt),
          active: form.active,
          sortOrder: Number.parseInt(form.sortOrder, 10) || 0,
          presets,
        },
      });
      toast.success("Pack saved.");
      setForm(null);
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the pack.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(row: AdminStudioPackRow) {
    setBusy(true);
    try {
      await postAdmin({ action: "studio_pack_delete", packId: row.id });
      toast.success(`Pack "${row.slug}" deleted.`);
      setConfirmDeleteId(null);
      if (form?.id === row.id) setForm(null);
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete the pack.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminPageFrame
      kicker="Internal Admin HQ"
      title="Studio preset packs"
      hint="Seasonal packs for Photo Studio and Image Studio. A pack renders only while it is switched on and inside its date window. A preset here replaces a built-in preset with the same id; the built-in Everyday styles always stay available."
    >
      <div className="mb-4 flex justify-end">
        <Button
          type="button"
          disabled={busy}
          onClick={() => setForm(blankForm())}
        >
          New pack
        </Button>
      </div>

      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        {data.packs.length === 0 ? (
          <p className="px-5 py-4 text-sm text-muted-foreground">
            No packs yet.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {data.packs.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
              >
                <div>
                  <p className="text-sm font-medium">
                    {row.name}{" "}
                    <span className="font-mono text-xs text-muted-foreground">
                      {row.slug}
                    </span>{" "}
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium">
                      {packStatus(row)}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {row.presets.length} preset{row.presets.length === 1 ? "" : "s"} ·{" "}
                    {windowLabel(row)}
                    {row.updatedBy ? ` · ${row.updatedBy}` : ""} ·{" "}
                    {new Date(row.updatedAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => setForm(formFromRow(row))}
                  >
                    Edit
                  </Button>
                  {confirmDeleteId === row.id ? (
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={busy}
                      onClick={() => void remove(row)}
                    >
                      Confirm delete
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => setConfirmDeleteId(row.id)}
                    >
                      Delete
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {form ? (
        <form
          className="mt-6 space-y-5 rounded-2xl border border-border bg-card p-5"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <p className="text-sm font-medium">
            {form.id ? `Edit pack — ${form.slug}` : "New pack"}
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="pack-name">Name</Label>
              <Input
                id="pack-name"
                value={form.name}
                onChange={(e) => patchForm({ name: e.target.value })}
                placeholder="Eid"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pack-slug">Slug</Label>
              <Input
                id="pack-slug"
                value={form.slug}
                onChange={(e) => patchForm({ slug: e.target.value })}
                placeholder="eid"
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="pack-description">Description (internal note)</Label>
              <Input
                id="pack-description"
                value={form.description}
                onChange={(e) => patchForm({ description: e.target.value })}
                placeholder="Eid ul Fitr 2027 window"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pack-start">Starts (blank = immediately)</Label>
              <Input
                id="pack-start"
                type="datetime-local"
                value={form.startsAt}
                onChange={(e) => patchForm({ startsAt: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pack-end">Ends (blank = no end)</Label>
              <Input
                id="pack-end"
                type="datetime-local"
                value={form.endsAt}
                onChange={(e) => patchForm({ endsAt: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pack-sort">Sort order</Label>
              <Input
                id="pack-sort"
                type="number"
                min={0}
                max={999}
                value={form.sortOrder}
                onChange={(e) => patchForm({ sortOrder: e.target.value })}
                className="w-28"
              />
            </div>
            <label className="flex items-center gap-2 pt-6 text-sm">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => patchForm({ active: e.target.checked })}
                className="size-4"
              />
              Switched on
            </label>
          </div>

          <div className="space-y-4">
            <p className="text-sm font-medium">Presets</p>
            {form.presets.map((preset, index) => (
              <fieldset
                key={index}
                className="space-y-3 rounded-xl border border-border p-4"
              >
                <div className="flex items-center justify-between">
                  <legend className="px-1 text-xs font-medium text-muted-foreground">
                    Preset {index + 1}
                  </legend>
                  {form.presets.length > 1 ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() =>
                        patchForm({
                          presets: form.presets.filter((_, i) => i !== index),
                        })
                      }
                    >
                      Remove preset
                    </Button>
                  ) : null}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Preset id</Label>
                    <Input
                      value={preset.id}
                      onChange={(e) => patchPreset(index, { id: e.target.value })}
                      placeholder="eid-card"
                      className="font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Label</Label>
                    <Input
                      value={preset.label}
                      onChange={(e) => patchPreset(index, { label: e.target.value })}
                      placeholder="Eid greeting card"
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Blurb</Label>
                    <Input
                      value={preset.blurb}
                      onChange={(e) => patchPreset(index, { blurb: e.target.value })}
                      placeholder="A festive Eid card design, ready to share."
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-4 text-sm">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={preset.edit}
                      onChange={(e) => patchPreset(index, { edit: e.target.checked })}
                      className="size-4"
                    />
                    Edit mode (restyle a photo)
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={preset.generate}
                      onChange={(e) =>
                        patchPreset(index, { generate: e.target.checked })
                      }
                      className="size-4"
                    />
                    Create mode (from a description)
                  </label>
                </div>
                <div className="space-y-1.5">
                  <Label>Edit prompt (sent as the restyle instruction)</Label>
                  <Textarea
                    value={preset.editPrompt}
                    onChange={(e) =>
                      patchPreset(index, { editPrompt: e.target.value })
                    }
                    rows={3}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Create style suffix (appended to the user prompt)</Label>
                  <Textarea
                    value={preset.generateSuffix}
                    onChange={(e) =>
                      patchPreset(index, { generateSuffix: e.target.value })
                    }
                    rows={2}
                  />
                </div>
              </fieldset>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() =>
                patchForm({ presets: [...form.presets, blankPreset()] })
              }
            >
              Add preset
            </Button>
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={busy}>
              Save pack
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => setForm(null)}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : null}
    </AdminPageFrame>
  );
}
