import { Smartphone, QrCode, Link2, RefreshCw, Bell, Search, Copy, Check } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { openExternal } from "@/lib/desktop-shell";
import { cinemCloudOrigin } from "@/lib/cinemCloud";
import {
  ackCompanionReminder,
  claimCompanionPair,
  companionSignedIn,
  pollCompanionReminders,
  sendCompanionCommand,
  startCompanionPair,
  type CompanionPairSession,
} from "@/lib/companionCloud";
import { createReminder } from "@/lib/reminders";
import { notify } from "@/store/useToastStore";

/** Mobile companion — pair code, QR/deep link, remote desk commands. */
export default function MobileCompanionPanel() {
  const [pair, setPair] = useState<CompanionPairSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [claimCode, setClaimCode] = useState("");

  const refreshPair = useCallback(async () => {
    if (!companionSignedIn()) return;
    setBusy(true);
    try {
      const session = await startCompanionPair();
      setPair(session);
      notify("success", "Pairing code ready — open the link on your phone.");
    } catch (error) {
      notify("error", error instanceof Error ? error.message : "Could not start pairing.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (!companionSignedIn()) return;
    const poll = window.setInterval(async () => {
      try {
        const pending = await pollCompanionReminders();
        for (const row of pending.commands ?? []) {
          const payload = row.payload ?? {};
          if (row.action === "reminder" && payload.text) {
            const atMs = payload.at ? new Date(String(payload.at)).getTime() - Date.now() : 3600_000;
            await createReminder(String(payload.text), Math.max(60_000, atMs));
            await ackCompanionReminder(row.id, { scheduled: true });
            notify("success", `Reminder from phone: ${payload.text}`);
          }
        }
      } catch {
        /* session may be refreshing */
      }
    }, 12_000);
    return () => window.clearInterval(poll);
  }, []);

  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      notify("error", "Could not copy link.");
    }
  }

  async function runResearchOnDesk() {
    if (!pair?.commandToken) {
      notify("error", "Generate a pairing code first.");
      return;
    }
    setBusy(true);
    try {
      await sendCompanionCommand({
        token: pair.commandToken,
        action: "research",
        query: "Multi-tab research triggered from Cinem AI Assistant mobile companion.",
      });
      notify("success", "Research job queued on your desk.");
    } catch (error) {
      notify("error", error instanceof Error ? error.message : "Could not queue research.");
    } finally {
      setBusy(false);
    }
  }

  async function claimFromPhone() {
    if (!claimCode.trim()) return;
    setBusy(true);
    try {
      await claimCompanionPair(claimCode.trim());
      notify("success", "Phone paired with this desk.");
    } catch (error) {
      notify("error", error instanceof Error ? error.message : "Could not claim code.");
    } finally {
      setBusy(false);
    }
  }

  const deskCompanionUrl = `${cinemCloudOrigin()}/desk?companion=1`;

  return (
    <div className="space-y-3 rounded border border-neon/15 bg-abyss/40 p-3 text-xs text-neon-dim">
      <p className="flex items-center gap-2 font-display text-[0.6rem] tracking-[0.2em] text-neon">
        <Smartphone className="size-3.5" /> MOBILE COMPANION
      </p>
      <p>
        Pair your phone to trigger desk research and reminders. Sign in with the same CINEM Pro account on
        mobile, then open the pair link or enter the code.
      </p>

      {!companionSignedIn() ? (
        <p className="text-rose-300">Sign in to CINEM Pro to generate a pairing code.</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              className="flex items-center gap-1 border border-neon/30 px-2 py-1 text-neon hover:bg-neon/10 disabled:opacity-50"
              onClick={() => void refreshPair()}
            >
              <QrCode className="size-3" /> {pair ? "New pair code" : "Generate pair code"}
            </button>
            {pair ? (
              <button
                type="button"
                className="flex items-center gap-1 border border-neon/30 px-2 py-1 text-neon hover:bg-neon/10"
                onClick={() => void copyLink(pair.pairUrl)}
              >
                {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
                Copy pair link
              </button>
            ) : null}
          </div>

          {pair ? (
            <div className="space-y-2 border border-neon/10 bg-abyss/60 p-2">
              <p className="font-display text-lg tracking-[0.35em] text-ice">{pair.pairCode}</p>
              <p className="text-[0.65rem]">
                Open on phone:{" "}
                <button
                  type="button"
                  className="text-neon underline"
                  onClick={() => void openExternal(pair.pairUrl)}
                >
                  {pair.pairUrl}
                </button>
              </p>
              <p className="text-[0.65rem]">Deep link: {pair.deepLink}</p>
              <p className="text-[0.65rem] text-neon-dim/80">
                Token expires {new Date(pair.expiresAt).toLocaleTimeString()} — regenerate if needed.
              </p>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              className="flex items-center gap-1 border border-neon/30 px-2 py-1 text-neon hover:bg-neon/10 disabled:opacity-50"
              onClick={() => void runResearchOnDesk()}
            >
              <Search className="size-3" /> Run research on desk
            </button>
            <button
              type="button"
              className="flex items-center gap-1 border border-neon/30 px-2 py-1 text-neon hover:bg-neon/10"
              onClick={() => void openExternal(deskCompanionUrl)}
            >
              <Link2 className="size-3" /> Open desk companion
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-neon/10 pt-2">
            <input
              value={claimCode}
              onChange={(e) => setClaimCode(e.target.value.toUpperCase())}
              placeholder="Pair code from desktop"
              className="min-w-[8rem] flex-1 border border-neon/20 bg-abyss/80 px-2 py-1 text-ice"
            />
            <button
              type="button"
              disabled={busy || !claimCode.trim()}
              className="flex items-center gap-1 border border-neon/30 px-2 py-1 text-neon hover:bg-neon/10"
              onClick={() => void claimFromPhone()}
            >
              <RefreshCw className="size-3" /> Claim on phone
            </button>
          </div>
        </>
      )}

      <p className="flex items-center gap-1 text-[0.65rem]">
        <Bell className="size-3" /> Reminder commands from phone appear in the assistant within ~12s.
      </p>
    </div>
  );
}
