"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Brain, Moon, Sun, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  CHAT_LANGUAGE_MODES,
  RESPONSE_LANGUAGE_BY_CODE,
  type ChatLanguageMode,
} from "@/lib/chat-language";

/**
 * Settings panel for the chat product. Appearance (light/dark) lives here;
 * the theme itself is owned by next-themes in the root layout, which
 * persists the choice to localStorage — this panel only flips it.
 * Custom instructions and remembered facts stay in the Memory panel;
 * this panel links to it instead of duplicating that state. The reply
 * language is owned by the chat app (persisted to the account) and only
 * rendered here.
 */
export function ChatSettingsPanel({
  open,
  onClose,
  onOpenMemory,
  languageMode,
  onLanguageModeChange,
}: {
  open: boolean;
  onClose: () => void;
  onOpenMemory: () => void;
  languageMode: ChatLanguageMode;
  onLanguageModeChange: (mode: ChatLanguageMode) => void;
}) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!open) return null;

  // Before mount, next-themes cannot know the resolved theme on the
  // client; fall back to the light default so the switch never flashes
  // the wrong active state.
  const isDark = mounted && resolvedTheme === "dark";

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close settings panel"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-border bg-background shadow-xl">
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
          <h2 className="text-[15px] font-semibold">Settings</h2>
          <Button variant="ghost" size="icon" aria-label="Close" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <section>
            <h3 className="text-sm font-medium">Appearance</h3>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Light by default. Your choice is saved on this device and used
              on your next visit.
            </p>
            <div
              className="mt-3 grid grid-cols-2 gap-1 rounded-full bg-muted p-1"
              role="group"
              aria-label="Appearance"
            >
              <button
                type="button"
                aria-pressed={!isDark}
                onClick={() => setTheme("light")}
                className={cn(
                  "inline-flex h-9 items-center justify-center gap-2 rounded-full text-sm font-medium transition",
                  !isDark
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Sun className="size-4" />
                Light
              </button>
              <button
                type="button"
                aria-pressed={isDark}
                onClick={() => setTheme("dark")}
                className={cn(
                  "inline-flex h-9 items-center justify-center gap-2 rounded-full text-sm font-medium transition",
                  isDark
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Moon className="size-4" />
                Dark
              </button>
            </div>
          </section>

          <section className="mt-8">
            <h3 className="text-sm font-medium">Response language</h3>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Auto replies in whatever language you write in. Pick a
              language to pin every reply to it. Saved to your account and
              used on all your devices.
            </p>
            <select
              aria-label="Response language"
              value={languageMode}
              onChange={(event) =>
                onLanguageModeChange(event.target.value as ChatLanguageMode)
              }
              className="mt-3 h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {CHAT_LANGUAGE_MODES.map((mode) =>
                mode === "auto" ? (
                  <option key={mode} value={mode}>
                    Auto — match my language
                  </option>
                ) : (
                  <option key={mode} value={mode}>
                    {RESPONSE_LANGUAGE_BY_CODE[mode].englishName} —{" "}
                    {RESPONSE_LANGUAGE_BY_CODE[mode].nativeName}
                  </option>
                ),
              )}
            </select>
          </section>

          <section className="mt-8">
            <h3 className="text-sm font-medium">Memory & instructions</h3>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Custom instructions and what CINEM Pro remembers about you are
              managed in the Memory panel.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={onOpenMemory}
            >
              <Brain className="size-4" />
              Open Memory & instructions
            </Button>
          </section>
        </div>
      </aside>
    </div>
  );
}
