import { Mail, Calendar, MessageCircle, Plug } from "lucide-react";

const PLUGINS = [
  { id: "gmail", name: "Gmail", icon: Mail, status: "Connect in desk Marketplace" },
  { id: "calendar", name: "Calendar", icon: Calendar, status: "Placeholder — coming soon" },
  { id: "whatsapp", name: "WhatsApp", icon: MessageCircle, status: "Sidecar via Settings → Remote" },
] as const;

/** Cinem-branded plugin marketplace registry placeholders. */
export default function PluginRegistryPanel() {
  return (
    <div className="space-y-2">
      <p className="flex items-center gap-2 font-display text-[0.6rem] tracking-[0.2em] text-neon">
        <Plug className="size-3.5" /> PLUGIN MARKETPLACE
      </p>
      <ul className="space-y-2">
        {PLUGINS.map((p) => (
          <li
            key={p.id}
            className="flex items-center justify-between border border-neon/15 bg-abyss/50 px-3 py-2 text-xs"
          >
            <span className="flex items-center gap-2 text-ice">
              <p.icon className="size-3.5 text-neon" /> {p.name}
            </span>
            <span className="text-neon-dim">{p.status}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
