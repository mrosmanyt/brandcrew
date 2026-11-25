"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Clapperboard, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type HiggsfieldState = {
  configured: boolean;
  models: { id: string; label: string; kind: "video" | "image" }[];
  docsUrl: string;
  consoleUrl: string;
};

type CheckState = {
  loading: boolean;
  ok?: boolean;
  text?: string;
};

/**
 * Higgsfield connector card: BYOK key ID + secret (the official
 * Higgsfield API at api.higgsfield.ai), stored encrypted via the
 * existing provider-key store. "Key saved" is not "key works" — the
 * Check button runs a real call against the live API and reports what
 * it answered. Generation itself is pay-per-use from the key owner's
 * own Higgsfield API balance (separate from web plans).
 */
export function HiggsfieldCard() {
  const [state, setState] = useState<HiggsfieldState | null>(null);
  const [keyId, setKeyId] = useState("");
  const [secret, setSecret] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState(false);
  const [check, setCheck] = useState<CheckState>({ loading: false });

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/chat/higgsfield");
      if (!response.ok) return;
      setState((await response.json()) as HiggsfieldState);
    } catch {
      // Card stays in its honest unloaded state; saving still works via BYOK.
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const patchKey = async (idValue: string, secretValue: string) => {
    const response = await fetch("/api/user/byok", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        higgsfieldKeyId: idValue,
        higgsfieldKeySecret: secretValue,
      }),
    });
    if (!response.ok) throw new Error("Could not save the key. Try again.");
  };

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    setSavedNote(false);
    try {
      await patchKey(keyId.trim(), secret.trim());
      setKeyId("");
      setSecret("");
      setSavedNote(true);
      setCheck({ loading: false });
      await load();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Could not save the key.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await patchKey("", "");
      setSavedNote(false);
      setCheck({ loading: false });
      await load();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Could not remove the key.");
    } finally {
      setSaving(false);
    }
  };

  const runCheck = async () => {
    setCheck({ loading: true });
    try {
      const response = await fetch("/api/chat/higgsfield", { method: "POST" });
      const body = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: string | null;
      } | null;
      if (!response.ok) throw new Error(body?.error || "The key check failed.");
      setCheck({
        loading: false,
        ok: Boolean(body?.ok),
        text: body?.ok
          ? "The Higgsfield API accepted this key. Generation calls will bill your Higgsfield API balance per use."
          : body?.error || "The API did not accept this key.",
      });
    } catch (err) {
      setCheck({
        loading: false,
        ok: false,
        text: err instanceof Error ? err.message : "The key check failed.",
      });
    }
  };

  const configured = Boolean(state?.configured);

  return (
    <section className="mt-10">
      <h2 className="flex items-center gap-2 text-base font-semibold">
        <Clapperboard className="size-4" /> Higgsfield — video &amp; image generation
      </h2>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">
        Higgsfield&apos;s official API generates video (including Seedance
        2.5) and images from your own API key. Create a key ID + secret in
        the{" "}
        <a
          href={state?.consoleUrl || "https://console.higgsfield.ai"}
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-2"
        >
          Higgsfield Console
        </a>
        , paste both halves here — they are stored encrypted and only ever
        sent to Higgsfield. API use is pay-per-generation from your
        Higgsfield API balance; website plan credits and
        &ldquo;unlimited&rdquo; do not apply to the API.
      </p>

      <div className="mt-4 rounded-3xl border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-[15px] font-semibold">Higgsfield API key</h3>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
              configured
                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                : "bg-muted text-muted-foreground",
            )}
          >
            {configured ? (
              <>
                <Check className="size-3" /> Key saved
              </>
            ) : (
              "Not configured"
            )}
          </span>
        </div>

        {state?.models?.length ? (
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            Models this API exposes include:{" "}
            {state.models.map((model) => model.label).join(" · ")}.
          </p>
        ) : null}

        <div className="mt-3 grid gap-2">
          <Input
            placeholder={
              configured ? "Key ID — leave blank to keep the saved one" : "Key ID"
            }
            value={keyId}
            onChange={(event) => setKeyId(event.target.value)}
          />
          <Input
            type="password"
            autoComplete="off"
            placeholder={
              configured ? "Key secret — leave blank to keep the saved one" : "Key secret"
            }
            value={secret}
            onChange={(event) => setSecret(event.target.value)}
          />
        </div>

        {saveError ? <p className="mt-2 text-sm text-destructive">{saveError}</p> : null}
        {savedNote ? (
          <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-300">
            Saved (encrypted). Now run Check key to verify it against the
            live Higgsfield API.
          </p>
        ) : null}

        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={saving || !keyId.trim() || !secret.trim()}
            onClick={() => void save()}
          >
            {saving ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Saving…
              </>
            ) : configured ? (
              "Replace key"
            ) : (
              "Save key"
            )}
          </Button>
          {configured ? (
            <>
              <Button
                size="sm"
                variant="secondary"
                disabled={check.loading}
                onClick={() => void runCheck()}
              >
                {check.loading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Checking…
                  </>
                ) : (
                  "Check key"
                )}
              </Button>
              <Button size="sm" variant="ghost" disabled={saving} onClick={() => void remove()}>
                Remove key
              </Button>
            </>
          ) : null}
        </div>

        {check.text ? (
          <p
            className={cn(
              "mt-3 rounded-2xl border px-3 py-2 text-xs leading-5",
              check.ok
                ? "border-emerald-500/40 bg-emerald-500/5"
                : "border-destructive/40 bg-destructive/5 text-destructive",
            )}
          >
            {check.text}
          </p>
        ) : null}

        <p className="mt-3 text-xs leading-5 text-muted-foreground">
          A saved key is not a verified key — only Check key talks to the
          live API. Full API reference:{" "}
          <a
            href={state?.docsUrl || "https://docs.higgsfield.ai"}
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2"
          >
            docs.higgsfield.ai
          </a>
          .
        </p>
      </div>
    </section>
  );
}
