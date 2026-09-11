export const COMPOSER_PLUS_ITEMS = [
  { id: "files", label: "Add files or photos", shortcut: "Ctrl U" },
  { id: "record-skill", label: "Record a skill" },
  { id: "build", label: "Build", section: true },
  { id: "examples", label: "Example prompts", section: true },
  { id: "skills", label: "Skills", submenu: true },
  { id: "connectors", label: "Connectors", submenu: true },
  { id: "plugins", label: "Add plugins" },
] as const;

export type ComposerAttachment = {
  name: string;
  size: number;
  text?: string;
};

const TEXT_NAME = /\.(md|txt|csv|json|html|css|js|ts|tsx|jsx)$/i;
const MAX_TEXT_CHARS = 20_000;

export function isComposerTextFile(file: { name: string; type: string }) {
  return file.type.startsWith("text/") || TEXT_NAME.test(file.name);
}

export function formatAttachedFiles(files: ComposerAttachment[]) {
  if (!files.length) return "";
  return files
    .map((file) => {
      if (file.text?.trim()) {
        return `Attached file ${file.name}:\n${file.text.trim()}`;
      }
      return `Attached file: ${file.name}`;
    })
    .join("\n\n");
}

export function composeJobMessage(input: string, files: ComposerAttachment[]) {
  return [input.trim(), formatAttachedFiles(files)].filter(Boolean).join("\n\n");
}

export function clipComposerText(text: string) {
  return text.length > MAX_TEXT_CHARS ? `${text.slice(0, MAX_TEXT_CHARS)}\n…` : text;
}

export function connectorStatusLabel(connected: boolean) {
  return connected ? "Connected" : "Not connected";
}

type FocusTarget = {
  tagName?: string;
  isContentEditable?: boolean;
};

/**
 * Keep the desk composer focused after send / reply, unless the user
 * moved to another field (clarification input, settings, etc.).
 */
export function shouldRefocusComposer(
  active: FocusTarget | null,
  composer: object | null,
): boolean {
  if (!composer) return false;
  if (!active || active === composer) return true;
  const tag = (active.tagName || "").toUpperCase();
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return false;
  if (active.isContentEditable) return false;
  return true;
}

export function focusComposer(
  composer: HTMLTextAreaElement | null,
  active: Element | null = null,
): boolean {
  if (!composer || composer.disabled) return false;
  if (!shouldRefocusComposer(active, composer)) return false;
  composer.focus({ preventScroll: true });
  return true;
}
