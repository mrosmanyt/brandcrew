import { Smartphone, QrCode, Link2 } from "lucide-react";
import { openExternal } from "@/lib/desktop-shell";
import { cinemCloudOrigin } from "@/lib/cinemCloud";

/** Mobile companion pairing stub — deep links for remote desk commands. */
export default function MobileCompanionStub() {
  const deskUrl = `${cinemCloudOrigin()}/desk?companion=1`;
  const researchDeepLink = `${cinemCloudOrigin()}/desk?action=research`;

  return (
    <div className="space-y-3 rounded border border-neon/15 bg-abyss/40 p-3 text-xs text-neon-dim">
      <p className="flex items-center gap-2 font-display text-[0.6rem] tracking-[0.2em] text-neon">
        <Smartphone className="size-3.5" /> MOBILE COMPANION (STUB)
      </p>
      <p>Pair your phone to trigger desk research and reminders remotely. Full native app coming soon.</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="flex items-center gap-1 border border-neon/30 px-2 py-1 text-neon hover:bg-neon/10"
          onClick={() => void openExternal(deskUrl)}
        >
          <QrCode className="size-3" /> Open desk pairing
        </button>
        <button
          type="button"
          className="flex items-center gap-1 border border-neon/30 px-2 py-1 text-neon hover:bg-neon/10"
          onClick={() => void openExternal(researchDeepLink)}
        >
          <Link2 className="size-3" /> Run research on desk
        </button>
      </div>
    </div>
  );
}
