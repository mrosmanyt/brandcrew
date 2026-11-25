"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUp,
  ArrowUpRight,
  BadgeAlert,
  Brain,
  Check,
  ChevronDown,
  ChevronsUpDown,
  FileText,
  Globe,
  ImagePlus,
  Languages,
  Loader2,
  LogOut,
  Mic,
  Paperclip,
  PanelLeft,
  Plug,
  Plus,
  Settings,
  Sparkles,
  Square,
  Users,
  X,
} from "lucide-react";
import type { ComposerAttachment } from "@/lib/composer";
import {
  COMPOSER_ACCEPT,
  COMPOSER_MAX_ATTACHMENTS,
  formatByteSize,
  stripDataUrlPrefix,
  toWireAttachments,
  validateComposerAttachment,
} from "@/lib/composer-media";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { publicModelLabel } from "@/lib/model-catalog";
import {
  createSseParser,
  parseSseData,
  type ChatDeltaData,
  type ChatDoneData,
  type ChatErrorData,
  type ChatSourcesData,
  type ChatStartData,
} from "@/lib/chat-stream-pure";
import {
  ChatErrorNotice,
  ChatMessageItem,
  type ChatUiMessage,
} from "./chat-message";
import { ChatSidebar, type ChatConversationSummary } from "./chat-sidebar";
import { ChatMemoryPanel } from "./chat-memory-panel";
import { ChatSettingsPanel } from "./chat-settings-panel";
import {
  CHAT_LANGUAGE_LABELS,
  CHAT_LANGUAGE_MODES,
  PAKISTANI_TEMPLATES,
  isChatLanguageMode,
  isRtlChatLanguage,
  type ChatLanguageMode,
} from "@/lib/chat-language";
import { getExpert } from "@/lib/experts";

const LANGUAGE_STORAGE_KEY = "cinem-chat-language";

type ModelOption = {
  id: string;
  displayName: string;
  provider: string;
  group: string | null;
  hint: string;
  configured: boolean;
};

type ModelGroup = { id: string; label: string };

type ChatError = {
  message: string;
  notConfigured: boolean;
  /** Calm inline notice (e.g. microphone help), not a failure banner. */
  notice?: boolean;
};

const SUGGESTIONS = [
  "Explain how neural networks learn, simply",
  "Write a Python function that dedupes a list",
  "Draft a polite follow-up email after an interview",
  "Give me a 7-day plan to learn TypeScript",
];

/** Read one picked file into a wire attachment (text inlined, media base64). */
async function readFileAsAttachment(file: File): Promise<ComposerAttachment> {
  const classified = validateComposerAttachment({
    name: file.name,
    type: file.type,
    size: file.size,
  });
  if (!classified.ok) {
    return { name: file.name, size: file.size, kind: "text", error: classified.error };
  }
  if (classified.kind === "text") {
    const text = (await file.text()).slice(0, 20_000);
    return {
      name: file.name,
      size: file.size,
      kind: "text",
      mime: classified.mime,
      text,
    };
  }
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("read failed"));
    reader.readAsDataURL(file);
  });
  return {
    name: file.name,
    size: file.size,
    kind: classified.kind,
    mime: classified.mime,
    data: stripDataUrlPrefix(dataUrl),
    previewUrl: classified.kind === "image" ? dataUrl : undefined,
  };
}

async function readJsonError(response: Response): Promise<ChatError> {
  try {
    const data = (await response.json()) as {
      error?: string;
      code?: string;
    };
    return {
      message: data.error || "The request failed. Try again.",
      notConfigured: data.code === "model_not_configured",
    };
  } catch {
    return { message: "The request failed. Try again.", notConfigured: false };
  }
}

export function ChatApp({
  userName,
  userEmail,
}: {
  userName: string;
  userEmail: string;
}) {
  const [conversations, setConversations] = useState<ChatConversationSummary[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeExpertId, setActiveExpertId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatUiMessage[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [models, setModels] = useState<ModelOption[]>([]);
  const [groups, setGroups] = useState<ModelGroup[]>([]);
  const [modelId, setModelId] = useState<string>("auto");
  const [input, setInput] = useState("");
  const [pendingAttachments, setPendingAttachments] = useState<ComposerAttachment[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<ChatError | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [webSearch, setWebSearch] = useState(false);
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [languageMode, setLanguageMode] = useState<ChatLanguageMode>(() => {
    if (typeof window === "undefined") return "auto";
    const saved = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return isChatLanguageMode(saved) ? saved : "auto";
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, languageMode);
    } catch {
      // Private mode etc. — the mode still applies to this session.
    }
  }, [languageMode]);

  // The saved account setting is the source of truth across devices:
  // adopt it on load, then persist every change back. Failures (signed
  // out, offline) leave the on-device choice in place for this session.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/chat/memory");
        if (!response.ok) return;
        const data = (await response.json()) as {
          responseLanguage?: unknown;
        };
        if (!cancelled && isChatLanguageMode(data.responseLanguage)) {
          setLanguageMode(data.responseLanguage);
        }
      } catch {
        // Keep the local choice.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const changeLanguageMode = useCallback((mode: ChatLanguageMode) => {
    setLanguageMode(mode);
    void (async () => {
      try {
        await fetch("/api/chat/memory", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ responseLanguage: mode }),
        });
      } catch {
        // The choice still applies on this device via localStorage.
      }
    })();
  }, []);

  const abortRef = useRef<AbortController | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordChunksRef = useRef<Blob[]>([]);
  const recordStreamRef = useRef<MediaStream | null>(null);
  const recordMimeRef = useRef<string>("audio/webm");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const stickToBottomRef = useRef(true);

  const refreshConversations = useCallback(async () => {
    try {
      const response = await fetch("/api/chat/conversations");
      if (!response.ok) return;
      const data = (await response.json()) as {
        conversations: ChatConversationSummary[];
      };
      setConversations(data.conversations);
    } catch {
      // List refresh is best-effort; the thread itself is the source of truth.
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/chat/conversations");
        if (!response.ok || cancelled) return;
        const data = (await response.json()) as {
          conversations: ChatConversationSummary[];
        };
        if (!cancelled) setConversations(data.conversations);
      } catch {
        // The sidebar simply stays empty until a later refresh succeeds.
      } finally {
        if (!cancelled) setListLoading(false);
      }
    })();
    void (async () => {
      try {
        const response = await fetch("/api/chat/models");
        if (!response.ok || cancelled) return;
        const data = (await response.json()) as {
          models?: unknown;
          groups?: unknown;
        };
        if (!cancelled) {
          // Validate the shape before it reaches state: a malformed payload
          // must degrade to the "Auto" only picker, never crash the header.
          setModels(
            Array.isArray(data.models) ? (data.models as ModelOption[]) : [],
          );
          setGroups(
            Array.isArray(data.groups) ? (data.groups as ModelGroup[]) : [],
          );
        }
      } catch {
        // Picker falls back to "Auto" only.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Experts gallery (Package 5) starts a chat by linking here with
  // ?conversation=<id>; open it once, then clean the URL so a refresh
  // does not keep re-selecting it.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("conversation");
    if (id) {
      void selectConversation(id);
      window.history.replaceState(null, "", "/chat");
    }
    // Mount-only: selectConversation is a stable useCallback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickToBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`;
  }, [input]);

  const selectConversation = useCallback(async (id: string) => {
    setActiveId(id);
    setError(null);
    setSidebarOpen(false);
    setThreadLoading(true);
    try {
      const response = await fetch(`/api/chat/conversations/${id}`);
      if (!response.ok) throw new Error("load failed");
      const data = (await response.json()) as {
        conversation: ChatConversationSummary;
        messages: Array<{
          id: string;
          role: "user" | "assistant";
          content: string;
          model: string | null;
          provider: string | null;
          attachments?: ComposerAttachment[];
          sources?: { title: string; url: string }[];
        }>;
      };
      setMessages(
        data.messages.map((row) => ({
          id: row.id,
          role: row.role,
          content: row.content,
          model: row.model,
          provider: row.provider,
          displayName: row.model ? publicModelLabel(row.model) : null,
          attachments: row.attachments?.length ? row.attachments : undefined,
          sources: row.sources?.length ? row.sources : undefined,
        })),
      );
      if (data.conversation.modelId) setModelId(data.conversation.modelId);
      setActiveExpertId(data.conversation.expertId ?? null);
      stickToBottomRef.current = true;
    } catch {
      setError({ message: "Could not load that chat. Try again.", notConfigured: false });
    } finally {
      setThreadLoading(false);
    }
  }, []);

  const startNewChat = useCallback(() => {
    abortRef.current?.abort();
    setActiveId(null);
    setActiveExpertId(null);
    setMessages([]);
    setPendingAttachments([]);
    setError(null);
    setSidebarOpen(false);
    textareaRef.current?.focus();
  }, []);

  const sendTurn = useCallback(
    async (history: ChatUiMessage[]) => {
      if (!history.length || history[history.length - 1].role !== "user") return;
      setError(null);
      stickToBottomRef.current = true;
      const placeholder: ChatUiMessage = {
        id: null,
        role: "assistant",
        content: "",
        streaming: true,
      };
      setMessages([...history, placeholder]);
      setStreaming(true);
      const controller = new AbortController();
      abortRef.current = controller;

      const patchAssistant = (patch: Partial<ChatUiMessage>) => {
        setMessages((current) => {
          const next = [...current];
          const lastIndex = next.length - 1;
          if (lastIndex >= 0 && next[lastIndex].role === "assistant") {
            next[lastIndex] = { ...next[lastIndex], ...patch };
          }
          return next;
        });
      };

      try {
        const response = await fetch("/api/chat/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversationId: activeId,
            modelId,
            languageMode,
            ...(activeExpertId ? { expertId: activeExpertId } : {}),
            ...(webSearch ? { webSearch: true } : {}),
            messages: history.map((row) => ({
              role: row.role,
              content: row.content,
              ...(row.attachments?.length
                ? { attachments: toWireAttachments(row.attachments) }
                : {}),
            })),
          }),
          signal: controller.signal,
        });
        const contentType = response.headers.get("content-type") || "";
        if (!response.ok || !contentType.includes("text/event-stream")) {
          setMessages(history);
          setError(await readJsonError(response));
          return;
        }
        const reader = response.body?.getReader();
        if (!reader) throw new Error("Streaming is not available in this browser.");
        const decoder = new TextDecoder();
        const parser = createSseParser();
        let sawDone = false;
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          const events = parser.push(decoder.decode(value, { stream: true }));
          for (const event of events) {
            if (event.event === "start") {
              const data = parseSseData<ChatStartData>(event.data);
              if (data?.conversationId) setActiveId(data.conversationId);
            } else if (event.event === "sources") {
              const data = parseSseData<ChatSourcesData>(event.data);
              if (data?.sources?.length) {
                patchAssistant({ sources: data.sources });
              }
            } else if (event.event === "delta") {
              const data = parseSseData<ChatDeltaData>(event.data);
              if (data?.text) {
                setMessages((current) => {
                  const next = [...current];
                  const lastIndex = next.length - 1;
                  if (lastIndex >= 0 && next[lastIndex].role === "assistant") {
                    next[lastIndex] = {
                      ...next[lastIndex],
                      content: next[lastIndex].content + data.text,
                    };
                  }
                  return next;
                });
              }
            } else if (event.event === "done") {
              const data = parseSseData<ChatDoneData>(event.data);
              sawDone = true;
              patchAssistant({
                id: data?.messageId ?? null,
                model: data?.model ?? null,
                provider: data?.provider ?? null,
                displayName: data?.displayName ?? null,
                streaming: false,
              });
              void refreshConversations();
            } else if (event.event === "error") {
              const data = parseSseData<ChatErrorData>(event.data);
              patchAssistant({ streaming: false });
              setError({
                message: data?.error || "The reply stopped unexpectedly.",
                notConfigured: data?.code === "model_not_configured",
              });
            }
          }
        }
        if (!sawDone) patchAssistant({ streaming: false });
      } catch (err) {
        patchAssistant({ streaming: false });
        if ((err as Error)?.name !== "AbortError") {
          setError({
            message: "Connection dropped while replying. Try again.",
            notConfigured: false,
          });
        }
      } finally {
        setStreaming(false);
        abortRef.current = null;
      }
    },
    [activeId, modelId, webSearch, languageMode, activeExpertId, refreshConversations],
  );

  const hasUsableAttachment = pendingAttachments.some((file) => !file.error);

  const handleSend = (event?: FormEvent) => {
    event?.preventDefault();
    const content = input.trim();
    if ((!content && !hasUsableAttachment) || streaming) return;
    const attachments = pendingAttachments.filter((file) => !file.error);
    setInput("");
    setPendingAttachments([]);
    void sendTurn([
      ...messages,
      {
        id: null,
        role: "user",
        content,
        ...(attachments.length ? { attachments } : {}),
      },
    ]);
  };

  const handleFilesPicked = async (files: FileList | null) => {
    if (!files?.length) return;
    const room = COMPOSER_MAX_ATTACHMENTS - pendingAttachments.length;
    const picked = Array.from(files).slice(0, Math.max(room, 0));
    const read = await Promise.all(picked.map((file) => readFileAsAttachment(file)));
    setPendingAttachments((current) =>
      [...current, ...read].slice(0, COMPOSER_MAX_ATTACHMENTS),
    );
  };

  const removePendingAttachment = (index: number) => {
    setPendingAttachments((current) => current.filter((_, i) => i !== index));
  };

  /**
   * Voice input: record a note, send it to Whisper, and drop the transcript
   * into the composer for review before sending. If voice is not configured
   * the server answers 503 and the honest notice shows — nothing is faked.
   */
  const transcribeRecording = useCallback(async (blob: Blob, mime: string) => {
    setTranscribing(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("read failed"));
        reader.readAsDataURL(blob);
      });
      const response = await fetch("/api/chat/voice/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audio: stripDataUrlPrefix(dataUrl),
          mime,
        }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          error?: string;
          code?: string;
        } | null;
        setError({
          message: data?.error || "Transcription failed. Try again.",
          notConfigured: data?.code === "voice_not_configured",
        });
        return;
      }
      const data = (await response.json()) as { text: string };
      if (data.text) {
        setInput((current) =>
          current.trim() ? `${current.trim()} ${data.text}` : data.text,
        );
        textareaRef.current?.focus();
      } else {
        setError({
          message: "I couldn't hear anything in that recording. Try again.",
          notConfigured: false,
        });
      }
    } catch {
      setError({
        message: "Transcription failed. Check your connection and try again.",
        notConfigured: false,
      });
    } finally {
      setTranscribing(false);
    }
  }, []);

  const toggleRecording = useCallback(async () => {
    if (recording) {
      recorderRef.current?.stop();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError({
        message: "Voice recording isn't available in this browser.",
        notConfigured: false,
        notice: true,
      });
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordStreamRef.current = stream;
      const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find(
        (candidate) => MediaRecorder.isTypeSupported(candidate),
      );
      const recorder = mime
        ? new MediaRecorder(stream, { mimeType: mime })
        : new MediaRecorder(stream);
      recordMimeRef.current = recorder.mimeType || mime || "audio/webm";
      recordChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size) recordChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        recordStreamRef.current?.getTracks().forEach((track) => track.stop());
        recordStreamRef.current = null;
        recorderRef.current = null;
        setRecording(false);
        const blob = new Blob(recordChunksRef.current, {
          type: recordMimeRef.current,
        });
        recordChunksRef.current = [];
        if (blob.size) void transcribeRecording(blob, recordMimeRef.current);
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      setError(null);
    } catch (err) {
      // Any start failure must leave the composer idle: release a stream
      // that was already acquired and clear the recording indicator.
      recordStreamRef.current?.getTracks().forEach((track) => track.stop());
      recordStreamRef.current = null;
      recorderRef.current = null;
      setRecording(false);
      const errorName =
        err instanceof DOMException || err instanceof Error ? err.name : "";
      const message =
        errorName === "NotAllowedError" || errorName === "SecurityError"
          ? "Microphone is off for this site. Click the lock icon in your browser's address bar, allow the microphone, then try again."
          : errorName === "NotFoundError" ||
              errorName === "OverconstrainedError"
            ? "No microphone found on this device."
            : "Couldn't start the microphone. Check it is connected, then try again.";
      setError({ message, notConfigured: false, notice: true });
    }
  }, [recording, transcribeRecording]);

  const lastUserIndex = (() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].role === "user") return i;
    }
    return -1;
  })();
  const lastAssistantIndex = messages.length - 1 >= 0 && messages[messages.length - 1].role === "assistant"
    ? messages.length - 1
    : -1;

  const handleRegenerate = () => {
    if (streaming || lastUserIndex < 0) return;
    void sendTurn(messages.slice(0, lastUserIndex + 1));
  };

  const handleEdit = (content: string) => {
    if (streaming || lastUserIndex < 0) return;
    const history = messages.slice(0, lastUserIndex + 1);
    history[lastUserIndex] = { ...history[lastUserIndex], content };
    void sendTurn(history);
  };

  const handleRename = async (id: string, title: string) => {
    setConversations((current) =>
      current.map((row) => (row.id === id ? { ...row, title } : row)),
    );
    try {
      await fetch(`/api/chat/conversations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
    } catch {
      void refreshConversations();
    }
  };

  const handleDelete = async (id: string) => {
    setConversations((current) => current.filter((row) => row.id !== id));
    if (id === activeId) startNewChat();
    try {
      await fetch(`/api/chat/conversations/${id}`, { method: "DELETE" });
    } catch {
      void refreshConversations();
    }
  };

  const router = useRouter();

  const activeExpert = getExpert(activeExpertId);

  /** Remove the expert from the open conversation (persisted via PATCH). */
  const clearExpert = async () => {
    setActiveExpertId(null);
    if (!activeId) return;
    setConversations((current) =>
      current.map((row) => (row.id === activeId ? { ...row, expertId: null } : row)),
    );
    try {
      await fetch(`/api/chat/conversations/${activeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expertId: null }),
      });
    } catch {
      void refreshConversations();
    }
  };

  const selectedModel = models.find((row) => row.id === modelId);
  const pickerLabel = modelId === "auto" ? "Auto" : selectedModel?.displayName ?? "Auto";

  const handleLogout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Even if the call fails, leave for /login — the session cookie is
      // what matters and a fresh page load re-checks it server-side.
    }
    window.location.assign("/login");
  }, []);

  const accountDisplayName = userName?.trim() || userEmail;
  const accountFooter =
    userName || userEmail ? (
      <DropdownMenu>
        <DropdownMenuTrigger
          className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition hover:bg-muted"
          aria-label="Account menu"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
            {(userName || userEmail || "?").slice(0, 1).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">
              {accountDisplayName}
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              {userEmail}
            </span>
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" className="w-64">
          <DropdownMenuGroup>
            <DropdownMenuLabel>{userEmail}</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => {
                setSidebarOpen(false);
                setSettingsOpen(true);
              }}
            >
              <Settings className="size-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push("/studio")}>
              <Sparkles className="size-4" />
              Studio
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push("/build")}>
              <Globe className="size-4" />
              Website Builder
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push("/experts")}>
              <Users className="size-4" />
              Experts
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push("/connectors")}>
              <Plug className="size-4" />
              Connectors
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                setSidebarOpen(false);
                setMemoryOpen(true);
              }}
            >
              <Brain className="size-4" />
              Memory
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push("/desk")}>
              <ArrowUpRight className="size-4" />
              Open desk
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => void handleLogout()}>
            <LogOut className="size-4" />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ) : (
      <a
        href="/login"
        className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-sm font-medium transition hover:bg-muted"
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
          ?
        </span>
        Sign in
      </a>
    );

  const sidebar = (
    <ChatSidebar
      conversations={conversations}
      activeId={activeId}
      loading={listLoading}
      onSelect={(id) => void selectConversation(id)}
      onNew={startNewChat}
      onRename={(id, title) => void handleRename(id, title)}
      onDelete={(id) => void handleDelete(id)}
      footer={accountFooter}
    />
  );

  return (
    <div className="flex h-[100dvh] bg-background text-foreground">
      <ChatMemoryPanel open={memoryOpen} onClose={() => setMemoryOpen(false)} />
      <ChatSettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        languageMode={languageMode}
        onLanguageModeChange={changeLanguageMode}
        onOpenMemory={() => {
          setSettingsOpen(false);
          setMemoryOpen(true);
        }}
      />
      <aside className="hidden w-72 shrink-0 border-r border-border bg-muted/30 md:block">
        {sidebar}
      </aside>
      {sidebarOpen ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            aria-label="Close chats list"
            className="absolute inset-0 bg-black/40"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-72 border-r border-border bg-background">
            {sidebar}
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border px-3 sm:px-4">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              aria-label="Open chats list"
              onClick={() => setSidebarOpen(true)}
            >
              <PanelLeft className="size-4" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger
                className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[15px] font-medium transition hover:bg-muted"
                aria-label="Choose model"
              >
                {pickerLabel}
                {modelId !== "auto" && selectedModel && !selectedModel.configured ? (
                  <BadgeAlert className="size-4 text-amber-500" />
                ) : null}
                <ChevronDown className="size-4 text-muted-foreground" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="max-h-[70vh] w-72 overflow-y-auto">
                <DropdownMenuItem onClick={() => setModelId("auto")}>
                  <span className="flex-1">
                    <span className="block font-medium">Auto</span>
                    <span className="block text-xs text-muted-foreground">
                      CINEM picks the best available model
                    </span>
                  </span>
                  {modelId === "auto" ? <Check className="size-4" /> : null}
                </DropdownMenuItem>
                {groups.map((group) => {
                  const rows = models.filter((row) => row.group === group.id);
                  if (rows.length === 0) return null;
                  return (
                    <Fragment key={group.id}>
                      <DropdownMenuSeparator />
                      <DropdownMenuGroup>
                        <DropdownMenuLabel>{group.label}</DropdownMenuLabel>
                        {rows.map((row) => (
                          <DropdownMenuItem key={row.id} onClick={() => setModelId(row.id)}>
                            <span className="flex-1">
                              <span className="block font-medium">{row.displayName}</span>
                              <span className="block text-xs text-muted-foreground">
                                {row.hint}
                                {row.configured ? "" : " · Not configured yet"}
                              </span>
                            </span>
                            {modelId === row.id ? <Check className="size-4" /> : null}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuGroup>
                    </Fragment>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
            {activeExpert ? (
              <span className="inline-flex items-center gap-2 rounded-full border border-border py-1 pl-1 pr-2 text-sm">
                <span
                  aria-hidden
                  className="flex size-6 items-center justify-center rounded-full text-[10px] font-bold text-white"
                  style={{ backgroundColor: activeExpert.color }}
                >
                  {activeExpert.letter}
                </span>
                <span className="max-w-36 truncate font-medium sm:max-w-none">
                  {activeExpert.name}
                </span>
                <button
                  type="button"
                  aria-label={`Remove expert ${activeExpert.name}`}
                  title="Remove expert"
                  className="rounded-full p-0.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  onClick={() => void clearExpert()}
                >
                  <X className="size-3.5" />
                </button>
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger
                className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
                aria-label="Choose reply language"
              >
                <Languages className="size-4" />
                {CHAT_LANGUAGE_LABELS[languageMode]}
                <ChevronDown className="size-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="max-h-80 w-56 overflow-y-auto">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Reply language</DropdownMenuLabel>
                  {CHAT_LANGUAGE_MODES.map((mode) => (
                    <DropdownMenuItem
                      key={mode}
                      onClick={() => changeLanguageMode(mode)}
                    >
                      <span className="flex-1">{CHAT_LANGUAGE_LABELS[mode]}</span>
                      {languageMode === mode ? <Check className="size-4" /> : null}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <div
          ref={scrollRef}
          dir={isRtlChatLanguage(languageMode) ? "rtl" : undefined}
          className="min-h-0 flex-1 overflow-y-auto"
          onScroll={(event) => {
            const el = event.currentTarget;
            stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 140;
          }}
        >
          <div className="mx-auto w-full max-w-3xl px-4 py-6">
            {threadLoading ? (
              <p className="py-16 text-center text-sm text-muted-foreground">Loading chat…</p>
            ) : messages.length === 0 && activeExpert ? (
              <div className="flex flex-col items-center justify-center py-14 text-center">
                <span
                  aria-hidden
                  className="flex size-14 items-center justify-center rounded-3xl text-base font-bold text-white"
                  style={{ backgroundColor: activeExpert.color }}
                >
                  {activeExpert.letter}
                </span>
                <h1 className="mt-4 font-heading text-3xl tracking-tight md:text-4xl">
                  {activeExpert.name}
                </h1>
                <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
                  {activeExpert.tagline} This expert stays active for the whole
                  conversation — tap a starter or just type your question.
                </p>
                <div className="mt-8 grid w-full max-w-xl gap-2 sm:grid-cols-2">
                  {activeExpert.starters.map((starter) => (
                    <button
                      key={starter}
                      type="button"
                      className="rounded-2xl border border-border px-4 py-3 text-left text-sm text-muted-foreground transition hover:bg-muted/60 hover:text-foreground"
                      onClick={() => {
                        if (!streaming) {
                          void sendTurn([{ id: null, role: "user", content: starter }]);
                        }
                      }}
                    >
                      {starter}
                    </button>
                  ))}
                </div>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 text-center">
                <h1 className="font-heading text-3xl tracking-tight md:text-4xl">
                  What can I help with?
                </h1>
                <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
                  Ask anything — answers stream in from the model you pick, and
                  every chat is saved in your history.
                </p>
                {languageMode === "ur" || languageMode === "roman-ur" ? (
                  <>
                    <p className="mt-8 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {languageMode === "ur"
                        ? "تیار شدہ ٹیمپلیٹس — ٹیپ کریں اور تفصیل بھر دیں"
                        : "Ready-made templates — tap karein aur tafseel bhar dein"}
                    </p>
                    <div className="mt-3 grid w-full max-w-xl gap-2 sm:grid-cols-2">
                      {PAKISTANI_TEMPLATES.map((template) => (
                        <button
                          key={template.id}
                          type="button"
                          className="rounded-2xl border border-border px-4 py-3 text-left text-sm text-muted-foreground transition hover:bg-muted/60 hover:text-foreground"
                          onClick={() => {
                            setInput(
                              languageMode === "ur"
                                ? template.promptUrdu
                                : template.promptRoman,
                            );
                            textareaRef.current?.focus();
                          }}
                        >
                          {languageMode === "ur"
                            ? template.labelUrdu
                            : template.labelRoman}
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="mt-8 grid w-full max-w-xl gap-2 sm:grid-cols-2">
                    {SUGGESTIONS.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        className="rounded-2xl border border-border px-4 py-3 text-left text-sm text-muted-foreground transition hover:bg-muted/60 hover:text-foreground"
                        onClick={() => {
                          if (!streaming) {
                            void sendTurn([{ id: null, role: "user", content: suggestion }]);
                          }
                        }}
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <ul className="space-y-6 pb-2">
                {messages.map((message, index) => (
                  <ChatMessageItem
                    key={message.id ?? `local-${index}`}
                    message={message}
                    isLastAssistant={index === lastAssistantIndex}
                    isLastUser={index === lastUserIndex}
                    busy={streaming}
                    onRegenerate={handleRegenerate}
                    onEdit={handleEdit}
                  />
                ))}
              </ul>
            )}
          </div>
        </div>

        <div
          className="shrink-0 px-4 pb-5 pt-1"
          dir={isRtlChatLanguage(languageMode) ? "rtl" : undefined}
        >
          {error ? (
            <ChatErrorNotice
              message={error.message}
              notConfigured={error.notConfigured}
              notice={error.notice}
              onRetry={
                !error.notice && !streaming && lastUserIndex >= 0
                  ? () => void sendTurn(messages.slice(0, lastUserIndex + 1))
                  : undefined
              }
            />
          ) : null}
          <form onSubmit={handleSend} className="mx-auto w-full max-w-3xl">
            <div className="rounded-[26px] border border-border bg-card p-2 shadow-sm">
              {pendingAttachments.length ? (
                <div className="flex flex-wrap gap-2 px-1 pb-2 pt-1">
                  {pendingAttachments.map((file, index) => (
                    <span
                      key={`${file.name}-${index}`}
                      className={
                        file.error
                          ? "inline-flex max-w-full items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive"
                          : "inline-flex items-center gap-2 rounded-xl bg-muted px-2.5 py-1.5 text-xs"
                      }
                    >
                      {file.previewUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={file.previewUrl}
                          alt=""
                          className="size-8 rounded-md object-cover"
                        />
                      ) : (
                        <FileText className="size-4 shrink-0 text-muted-foreground" />
                      )}
                      <span className="max-w-48 truncate">
                        {file.error ?? `${file.name} · ${formatByteSize(file.size)}`}
                      </span>
                      <button
                        type="button"
                        aria-label={`Remove ${file.name}`}
                        className="rounded-full p-0.5 text-muted-foreground transition hover:bg-background hover:text-foreground"
                        onClick={() => removePendingAttachment(index)}
                      >
                        <X className="size-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}
              <input
                ref={fileInputRef}
                type="file"
                accept={COMPOSER_ACCEPT}
                multiple
                className="hidden"
                aria-hidden="true"
                tabIndex={-1}
                onChange={(event) => {
                  void handleFilesPicked(event.target.files);
                  event.target.value = "";
                }}
              />
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event: KeyboardEvent<HTMLTextAreaElement>) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    handleSend();
                  }
                }}
                rows={1}
                placeholder={
                  recording
                    ? "Listening… tap the mic again to stop"
                    : transcribing
                      ? "Transcribing your voice note…"
                      : "Ask anything"
                }
                aria-label="Message"
                className="max-h-[200px] w-full resize-none border-0 bg-transparent px-3 py-2 shadow-none focus-visible:ring-0"
              />
              <div className="flex items-center gap-1.5 px-1 pt-1">
                <DropdownMenu>
                  <DropdownMenuTrigger
                    className="grid size-9 shrink-0 place-items-center rounded-full transition hover:bg-muted"
                    aria-label="Composer tools"
                  >
                    <Plus className="size-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent side="top" align="start" className="w-64">
                    <DropdownMenuCheckboxItem
                      checked={webSearch}
                      onCheckedChange={(checked) => setWebSearch(checked)}
                      disabled={streaming}
                    >
                      <Globe className="size-4" />
                      Search the web
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuItem
                      onClick={() => fileInputRef.current?.click()}
                      disabled={
                        streaming ||
                        pendingAttachments.length >= COMPOSER_MAX_ATTACHMENTS
                      }
                    >
                      <Paperclip className="size-4" />
                      Attach photo or file
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => void toggleRecording()}
                      disabled={streaming || transcribing}
                    >
                      <Mic className="size-4" />
                      {recording ? "Stop recording" : "Record audio"}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => router.push("/studio")}>
                      <ImagePlus className="size-4" />
                      Make an image
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  type="button"
                  size="icon"
                  variant={recording ? "destructive" : "ghost"}
                  className="size-9 shrink-0 rounded-full"
                  aria-label={recording ? "Stop recording" : "Record a voice note"}
                  disabled={streaming || transcribing}
                  onClick={() => void toggleRecording()}
                >
                  {transcribing ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Mic className={`size-4 ${recording ? "animate-pulse" : ""}`} />
                  )}
                </Button>
                {webSearch ? (
                  <button
                    type="button"
                    onClick={() => setWebSearch(false)}
                    disabled={streaming}
                    className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-secondary px-3 text-xs font-medium text-secondary-foreground transition hover:opacity-90 disabled:opacity-50"
                    aria-label="Turn off web search"
                    title="Web search is on — tap to turn it off"
                  >
                    <Globe className="size-3.5" />
                    Search on
                    <X className="size-3.5" />
                  </button>
                ) : null}
                <div className="flex-1" />
                {streaming ? (
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    className="size-9 shrink-0 rounded-full"
                    aria-label="Stop generating"
                    onClick={() => abortRef.current?.abort()}
                  >
                    <Square className="size-4" />
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    size="icon"
                    className="size-9 shrink-0 rounded-full"
                    aria-label="Send message"
                    disabled={!input.trim() && !hasUsableAttachment}
                  >
                    <ArrowUp className="size-4" />
                  </Button>
                )}
              </div>
            </div>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              CINEM Pro can make mistakes. Check important info before you rely on it.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
