"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import Link from "next/link";
import {
  ArrowUp,
  BadgeAlert,
  Check,
  ChevronDown,
  FileText,
  Globe,
  Loader2,
  Mic,
  Paperclip,
  PanelLeft,
  Square,
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
  DropdownMenuContent,
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

type ModelOption = {
  id: string;
  displayName: string;
  provider: string;
  group: string | null;
  hint: string;
  configured: boolean;
};

type ModelGroup = { id: string; label: string };

type ChatError = { message: string; notConfigured: boolean };

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
          models: ModelOption[];
          groups: ModelGroup[];
        };
        if (!cancelled) {
          setModels(data.models);
          setGroups(data.groups);
        }
      } catch {
        // Picker falls back to "Auto" only.
      }
    })();
    return () => {
      cancelled = true;
    };
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
    [activeId, modelId, webSearch, refreshConversations],
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
    } catch {
      setError({
        message: "Microphone access was blocked. Allow it in your browser to use voice.",
        notConfigured: false,
      });
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

  const selectedModel = models.find((row) => row.id === modelId);
  const pickerLabel = modelId === "auto" ? "Auto" : selectedModel?.displayName ?? "Auto";

  const sidebar = (
    <ChatSidebar
      conversations={conversations}
      activeId={activeId}
      loading={listLoading}
      onSelect={(id) => void selectConversation(id)}
      onNew={startNewChat}
      onRename={(id, title) => void handleRename(id, title)}
      onDelete={(id) => void handleDelete(id)}
    />
  );

  return (
    <div className="flex h-[100dvh] bg-background text-foreground">
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
                {groups.map((group) => (
                  <div key={group.id}>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>{group.label}</DropdownMenuLabel>
                    {models
                      .filter((row) => row.group === group.id)
                      .map((row) => (
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
                  </div>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/desk"
              className="hidden text-sm text-muted-foreground transition hover:text-foreground sm:block"
            >
              Open desk
            </Link>
            <span
              className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
              title={`${userName} · ${userEmail}`}
            >
              {(userName || userEmail || "?").slice(0, 1).toUpperCase()}
            </span>
          </div>
        </header>

        <div
          ref={scrollRef}
          className="min-h-0 flex-1 overflow-y-auto"
          onScroll={(event) => {
            const el = event.currentTarget;
            stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 140;
          }}
        >
          <div className="mx-auto w-full max-w-3xl px-4 py-6">
            {threadLoading ? (
              <p className="py-16 text-center text-sm text-muted-foreground">Loading chat…</p>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 text-center">
                <h1 className="font-heading text-3xl tracking-tight md:text-4xl">
                  What can I help with?
                </h1>
                <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
                  Ask anything — answers stream in from the model you pick, and
                  every chat is saved in your history.
                </p>
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

        <div className="shrink-0 px-4 pb-5 pt-1">
          {error ? (
            <ChatErrorNotice
              message={error.message}
              notConfigured={error.notConfigured}
              onRetry={
                !streaming && lastUserIndex >= 0
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
              <div className="flex items-end gap-2">
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
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-9 shrink-0 rounded-full"
                aria-label="Attach photos or files"
                disabled={streaming || pendingAttachments.length >= COMPOSER_MAX_ATTACHMENTS}
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip className="size-4" />
              </Button>
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
              <Button
                type="button"
                size="sm"
                variant={webSearch ? "secondary" : "ghost"}
                className="h-9 shrink-0 gap-1.5 rounded-full px-3 text-xs"
                aria-pressed={webSearch}
                aria-label="Toggle web search"
                title="Search the web for current information"
                disabled={streaming}
                onClick={() => setWebSearch((current) => !current)}
              >
                <Globe className="size-4" />
                Search
              </Button>
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
                className="max-h-[200px] resize-none border-0 bg-transparent px-3 py-2 shadow-none focus-visible:ring-0"
              />
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
