import { useEffect, useRef, useState } from "react";
import {
  X, Minus, Maximize2, Minimize2, ExternalLink, Globe, FlaskConical, Clapperboard,
  CheckCircle2, AlertTriangle, ChevronRight, Loader2, FolderCog, File,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTaskStore, type TaskWin } from "@/store/useTaskStore";
import { openExternal } from "@/lib/quickActions";
import Markdown from "@/components/Markdown";
import { cn } from "@/lib/utils";

const CUT = {
  clipPath:
    "polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)",
} as const;

/** Window frame cut — top-left corner only, so the native bottom-right
 *  resize grip stays clickable (clip-path clips hit-testing too). */
const WIN_CUT = {
  clipPath: "polygon(14px 0, 100% 0, 100% 100%, 0 100%, 0 14px)",
} as const;

const KIND_ICON = {
  web: <Globe className="size-3.5" />,
  research: <FlaskConical className="size-3.5" />,
  editor: <Clapperboard className="size-3.5" />,
  files: <FolderCog className="size-3.5" />,
} as const;

/* ── Progress bar (determinate / shimmer / done / error) ──────────── */

function ProgressBar({ t }: { t: TaskWin }) {
  if (t.status === "done") {
    return <div className="h-0.5 w-full bg-neon shadow-[0_0_8px_rgba(var(--glow),0.8)]" />;
  }
  if (t.status === "error") {
    return <div className="h-0.5 w-full bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.8)]" />;
  }
  if (t.progress !== null) {
    return (
      <div className="h-0.5 w-full bg-neon/15">
        <motion.div
          className="h-full bg-neon shadow-[0_0_8px_rgba(var(--glow),0.8)]"
          animate={{ width: `${t.progress}%` }}
          transition={{ ease: "easeOut", duration: 0.4 }}
        />
      </div>
    );
  }
  return (
    <div className="h-0.5 w-full overflow-hidden bg-neon/15">
      <div className="task-shimmer h-full w-1/3 bg-neon shadow-[0_0_8px_rgba(var(--glow),0.8)]" />
    </div>
  );
}

/* ── Window body per task kind ────────────────────────────────────── */

function WebBody({ t }: { t: TaskWin }) {
  if (!t.url) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-neon-dim">
        <Globe className="size-8 opacity-60" />
        <p className="text-sm">Opened in your system browser.</p>
      </div>
    );
  }
  return (
    <iframe
      src={t.url}
      title={t.title}
      className="h-full w-full border-0 bg-white"
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      referrerPolicy="no-referrer"
    />
  );
}

function StepsLog({ t }: { t: TaskWin }) {
  return (
    <ul className="space-y-1">
      {t.steps.map((s, i) => (
        <motion.li
          key={i}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-start gap-1.5 text-xs text-ice/80"
        >
          <ChevronRight className="mt-0.5 size-3 shrink-0 text-neon-dim" />
          {s}
        </motion.li>
      ))}
      {t.status === "working" && (
        <li className="flex items-center gap-1.5 text-xs text-neon">
          <Loader2 className="size-3 animate-spin" /> working…
        </li>
      )}
    </ul>
  );
}

function ResearchBody({ t }: { t: TaskWin }) {
  return (
    <div className="h-full space-y-3 overflow-y-auto p-4">
      <StepsLog t={t} />

      {!!t.sources?.length && (
        <div>
          <p className="mb-1.5 font-display text-[0.55rem] tracking-[0.25em] text-neon-dim">
            LIVE SOURCES
          </p>
          <ul className="space-y-1">
            {t.sources.map((s) => (
              <li key={s.url}>
                <button
                  onClick={() => void openExternal(s.url)}
                  className="flex w-full items-center gap-2 border border-neon/15 bg-abyss/60 px-2 py-1.5 text-left text-xs text-ice/85 transition-colors hover:border-neon/40 hover:text-ice"
                >
                  <ExternalLink className="size-3 shrink-0 text-neon-dim" />
                  <span className="truncate">{s.title}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {t.result && (
        <div className="border-t border-neon/15 pt-3">
          <Markdown>{t.result}</Markdown>
        </div>
      )}
    </div>
  );
}

function EditorBody({ t }: { t: TaskWin }) {
  return (
    <div className="flex h-full flex-col gap-3 p-4">
      {/* Preview canvas */}
      <div
        className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden border border-neon/20 bg-gradient-to-br from-fuchsia-500/20 via-abyss to-cyan-400/20"
        style={CUT}
      >
        <Clapperboard
          className={cn(
            "size-12 text-neon/70 drop-shadow-[0_0_14px_rgba(var(--glow),0.6)]",
            t.status === "working" && "animate-pulse",
          )}
        />
        {t.progress !== null && (
          <span className="absolute bottom-2 right-3 font-display text-2xl font-bold text-neon/90">
            {Math.round(t.progress)}%
          </span>
        )}
        {/* scan line while rendering */}
        {t.status === "working" && (
          <motion.div
            className="absolute inset-x-0 h-px bg-neon/70 shadow-[0_0_10px_rgba(var(--glow),0.9)]"
            animate={{ top: ["8%", "92%", "8%"] }}
            transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
      </div>
      <StepsLog t={t} />
      {t.result && <p className="text-xs leading-relaxed text-ice/85">{t.result}</p>}
    </div>
  );
}

/** MAX file operations — preview rows + live step log. */
function FilesBody({ t }: { t: TaskWin }) {
  return (
    <div className="flex h-full flex-col gap-2.5 overflow-hidden p-4">
      {!!t.files?.length && (
        <div className="min-h-0 flex-1 overflow-y-auto border border-neon/15 bg-abyss/50">
          {t.files.map((f, i) => (
            <div
              key={`${f.name}-${i}`}
              className="flex items-center gap-2 border-b border-neon/[0.06] px-2.5 py-1.5 text-xs"
            >
              <File className="size-3 shrink-0 text-neon-dim" />
              <span className="min-w-0 flex-1 truncate text-ice/85">{f.name}</span>
              <span className="shrink-0 tabular-nums text-neon-dim">{f.sizeMb.toFixed(1)} MB</span>
              <span className="shrink-0 border border-neon/30 bg-neon/10 px-1.5 py-0.5 font-display text-[0.5rem] tracking-[0.12em] text-neon">
                {f.tag}
              </span>
            </div>
          ))}
        </div>
      )}
      <StepsLog t={t} />
      {t.result && <p className="text-xs leading-relaxed text-ice/85">{t.result}</p>}
    </div>
  );
}

/* ── The floating window ──────────────────────────────────────────── */

function Window({ t }: { t: TaskWin }) {
  const setTaskMode = useTaskStore((s) => s.setTaskMode);
  const closeTask = useTaskStore((s) => s.closeTask);

  const full = t.mode === "full";
  const [pos, setPos] = useState({ x: 0, y: 0 }); // drag offset from anchor
  const drag = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(null);

  // drag via title bar (popup mode only)
  const onPointerDown = (e: React.PointerEvent) => {
    if (full) return;
    drag.current = { startX: e.clientX, startY: e.clientY, baseX: pos.x, baseY: pos.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    setPos({
      x: drag.current.baseX + e.clientX - drag.current.startX,
      y: drag.current.baseY + e.clientY - drag.current.startY,
    });
  };
  const onPointerUp = () => (drag.current = null);

  const statusLabel =
    t.status === "done" ? "COMPLETE" : t.status === "error" ? "ERROR" : "WORKING";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94 }}
      transition={{ type: "spring", stiffness: 320, damping: 28 }}
      className={cn(
        "pointer-events-auto fixed z-[70] flex flex-col border border-neon/30 bg-abyss/90 shadow-[0_0_40px_rgba(var(--glow),0.2)] backdrop-blur-xl",
        full ? "inset-4" : "bottom-28 right-6 h-[440px] w-[580px] max-w-[92vw]",
      )}
      style={{
        ...WIN_CUT,
        // drag offset goes through framer's x/y so it composes with the
        // enter/exit scale animation instead of fighting it
        ...(full
          ? {}
          : {
              x: pos.x,
              y: pos.y,
              resize: "both" as const,
              overflow: "hidden",
              minWidth: 360,
              minHeight: 260,
            }),
      }}
    >
      {/* Title bar */}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className={cn(
          "flex shrink-0 select-none items-center gap-2.5 border-b border-neon/15 bg-abyss/80 px-3 py-2",
          !full && "cursor-grab active:cursor-grabbing",
        )}
      >
        <span className="text-neon">{KIND_ICON[t.kind]}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-ice">{t.title}</p>
            <span className="truncate text-[0.65rem] text-neon-dim">{t.subtitle}</span>
          </div>
        </div>

        {/* glowing agent badge */}
        <span className="hidden items-center gap-1.5 border border-neon/40 bg-neon/10 px-2 py-0.5 font-display text-[0.52rem] font-bold tracking-[0.18em] text-neon shadow-[0_0_10px_rgba(var(--glow),0.25)] sm:flex">
          <span className={cn("size-1.5 rounded-full", t.status === "working" ? "bg-neon dot-active" : t.status === "done" ? "bg-neon" : "bg-rose-400")} />
          {t.agent}
        </span>

        {/* status */}
        <span
          className={cn(
            "flex items-center gap-1 font-display text-[0.52rem] tracking-[0.2em]",
            t.status === "done" ? "text-neon" : t.status === "error" ? "text-rose-300" : "text-amber-200",
          )}
        >
          {t.status === "done" ? (
            <CheckCircle2 className="size-3" />
          ) : t.status === "error" ? (
            <AlertTriangle className="size-3" />
          ) : (
            <Loader2 className="size-3 animate-spin" />
          )}
          {statusLabel}
        </span>

        {/* controls */}
        <div className="flex items-center gap-1">
          {t.externalUrl && (
            <button
              onClick={() => void openExternal(t.externalUrl!)}
              title="Open in system browser"
              className="p-1 text-neon-dim transition-colors hover:text-neon"
            >
              <ExternalLink className="size-3.5" />
            </button>
          )}
          <button
            onClick={() => setTaskMode(t.id, "min")}
            title="Minimize"
            className="p-1 text-neon-dim transition-colors hover:text-neon"
          >
            <Minus className="size-3.5" />
          </button>
          <button
            onClick={() => {
              setTaskMode(t.id, full ? "popup" : "full");
              if (!full) setPos({ x: 0, y: 0 });
            }}
            title={full ? "Restore popup" : "Expand to full view"}
            className="p-1 text-neon-dim transition-colors hover:text-neon"
          >
            {full ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
          </button>
          <button
            onClick={() => closeTask(t.id)}
            title="Close"
            className="p-1 text-neon-dim transition-colors hover:text-rose-300"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>

      <ProgressBar t={t} />

      {/* Body */}
      <div className="min-h-0 flex-1 overflow-hidden">
        {t.kind === "web" ? (
          <WebBody t={t} />
        ) : t.kind === "research" ? (
          <ResearchBody t={t} />
        ) : t.kind === "files" ? (
          <FilesBody t={t} />
        ) : (
          <EditorBody t={t} />
        )}
      </div>

      {/* Footer action bar (MAX: EXECUTE / CANCEL / UNDO …) */}
      {!!t.actions?.length && (
        <div className="flex shrink-0 justify-end gap-2 border-t border-neon/15 bg-abyss/80 px-3 py-2">
          {t.actions.map((a) => (
            <button
              key={a.id}
              onClick={() => t.onAction?.(a.id)}
              className={cn(
                "border px-3 py-1.5 font-display text-[0.6rem] font-bold tracking-[0.2em] transition-all",
                a.variant === "primary" &&
                  "border-neon/60 bg-neon/15 text-neon hover:bg-neon/25 hover:shadow-[0_0_14px_rgba(var(--glow),0.35)]",
                a.variant === "danger" &&
                  "border-rose-400/50 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20",
                a.variant === "ghost" && "border-neon/15 text-neon-dim hover:text-ice",
              )}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </motion.div>
  );
}

/* ── Minimized dock (bottom-right chips) ──────────────────────────── */

function Dock({ tasks }: { tasks: TaskWin[] }) {
  const setTaskMode = useTaskStore((s) => s.setTaskMode);
  const closeTask = useTaskStore((s) => s.closeTask);

  return (
    <div className="pointer-events-auto fixed bottom-24 right-6 z-[65] flex flex-col items-end gap-1.5">
      <AnimatePresence>
        {tasks.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 30 }}
            className="flex items-center gap-2 border border-neon/30 bg-abyss/90 px-2.5 py-1.5 shadow-[0_0_14px_rgba(var(--glow),0.15)] backdrop-blur"
            style={{ clipPath: "polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)" }}
          >
            <span className="text-neon">{KIND_ICON[t.kind]}</span>
            <button
              onClick={() => setTaskMode(t.id, "popup")}
              className="max-w-[180px] truncate text-xs text-ice/85 transition-colors hover:text-neon"
              title="Restore"
            >
              {t.title}
            </button>
            {t.status === "working" ? (
              <Loader2 className="size-3 animate-spin text-amber-200" />
            ) : t.status === "done" ? (
              <CheckCircle2 className="size-3 text-neon" />
            ) : (
              <AlertTriangle className="size-3 text-rose-300" />
            )}
            <button onClick={() => closeTask(t.id)} className="text-neon-dim hover:text-rose-300" title="Close">
              <X className="size-3" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

/* ── Overlay root (rendered once in App) ──────────────────────────── */

/** Cinem AI Assistant Visual Task Execution — floating task windows + minimized dock. */
export default function TaskWindows() {
  const tasks = useTaskStore((s) => s.tasks);
  const visible = tasks.filter((t) => t.mode !== "min");
  const minimized = tasks.filter((t) => t.mode === "min");

  // ESC closes full-view back to popup
  const setTaskMode = useTaskStore((s) => s.setTaskMode);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const fullTask = useTaskStore.getState().tasks.find((t) => t.mode === "full");
      if (fullTask) setTaskMode(fullTask.id, "popup");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setTaskMode]);

  return (
    <div className="pointer-events-none fixed inset-0 z-[60]">
      <AnimatePresence>
        {visible.map((t) => (
          <Window key={t.id} t={t} />
        ))}
      </AnimatePresence>
      {minimized.length > 0 && <Dock tasks={minimized} />}
    </div>
  );
}
