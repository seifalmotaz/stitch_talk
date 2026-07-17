"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PlusIcon, SparklesIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { clearMessages, loadMessages, saveMessages } from "@/lib/storage";
import type { ChatMessage, WireMessage } from "@/types/chat";

import { BriefDialog } from "./BriefDialog";
import { ChatInput } from "./ChatInput";
import { EmptyState } from "./EmptyState";
import { MessageList } from "./MessageList";

/**
 * The whole chat experience. Owns:
 *   - the message list (loaded from / saved to localStorage)
 *   - the streaming request lifecycle for chat completions
 *   - the brief-generation request lifecycle
 *   - the brief dialog open state
 *
 * Everything else is a presentational child.
 */
export function ChatShell() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [briefOpen, setBriefOpen] = useState(false);

  // Hold the in-flight controller so we could abort on unmount (not used
  // for v0.1 but kept for future "stop generating" button).
  const abortRef = useRef<AbortController | null>(null);

  // Hydrate from localStorage exactly once on mount. This is the documented
  // "hydrate after render" pattern for client-only persistence — we can't
  // initialize from localStorage in useState because window/localStorage
  // don't exist during SSR, and a lazy initializer would freeze the empty
  // server snapshot into the client state forever.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- see comment above */
    setMessages(loadMessages());
    setHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  // Persist on every change after hydration. We intentionally don't gate on
  // isStreaming — saving an in-progress stream is fine; on reload the UI
  // just renders whatever was last written.
  useEffect(() => {
    if (!hydrated) return;
    saveMessages(messages);
  }, [messages, hydrated]);

  /**
   * Count of substantive user turns (used to gate the Generate Brief button).
   * Empty starters from the empty state don't count toward "2 user messages"
   * until the assistant has had a chance to respond, so we use this guard.
   */
  const userTurnCount = useMemo(
    () => messages.filter((m) => m.role === "user").length,
    [messages]
  );
  const canGenerateBrief = userTurnCount >= 2 && !isStreaming;

  const handleNewChat = useCallback(() => {
    if (isStreaming) {
      abortRef.current?.abort();
    }
    clearMessages();
    setMessages([]);
    setStreamError(null);
  }, [isStreaming]);

  const handleSend = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isStreaming) return;

      setStreamError(null);

      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: trimmed,
        createdAt: Date.now(),
      };

      // Placeholder assistant message that we'll append to as tokens stream in.
      const assistantId = crypto.randomUUID();
      const assistantMsg: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        createdAt: Date.now(),
        streaming: true,
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setIsStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const wireMessages: WireMessage[] = [...messages, userMsg].map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ messages: wireMessages }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          const errText = await res.text().catch(() => "");
          throw new Error(
            errText || `Chat request failed with status ${res.status}`
          );
        }

        await consumeSseStream(res.body, {
          onDelta: (delta) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, content: m.content + delta }
                  : m
              )
            );
          },
          onErrorEvent: (message) => {
            // Surface a final error message inside the assistant bubble.
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? {
                      ...m,
                      content:
                        m.content ||
                        "Sorry — I hit an error while generating that reply. Try again?",
                      error: true,
                      streaming: false,
                    }
                  : m
              )
            );
            setStreamError(message);
          },
        });
      } catch (err) {
        if ((err as { name?: string })?.name === "AbortError") return;
        const message =
          err instanceof Error ? err.message : "Something went wrong";
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content:
                    m.content ||
                    "Sorry — I hit an error while generating that reply. Try again?",
                  error: true,
                  streaming: false,
                }
              : m
          )
        );
        setStreamError(message);
      } finally {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, streaming: false } : m
          )
        );
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [isStreaming, messages]
  );

  const handlePickStarter = useCallback(
    (text: string) => {
      void handleSend(text);
    },
    [handleSend]
  );

  // Snapshot of the conversation passed to the brief dialog. We compute it
  // here so the dialog opens on a fixed transcript even if the user keeps
  // chatting while it's open.
  const briefMessages = useMemo<WireMessage[]>(
    () => messages.map((m) => ({ role: m.role, content: m.content })),
    [messages]
  );

  const hasMessages = messages.length > 0;

  return (
    <div className="flex h-dvh flex-col">
      <Header
        canGenerateBrief={canGenerateBrief}
        onNewChat={handleNewChat}
        onGenerateBrief={() => setBriefOpen(true)}
        hasMessages={hasMessages}
      />

      {streamError && (
        <div
          role="alert"
          className="mx-auto mt-2 w-full max-w-2xl px-4 sm:px-6"
        >
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            {streamError}
          </div>
        </div>
      )}

      {hasMessages ? (
        <MessageList messages={messages} />
      ) : (
        <EmptyState onPick={handlePickStarter} />
      )}

      <ChatInput onSend={handleSend} disabled={isStreaming} />

      <BriefDialog
        open={briefOpen}
        onOpenChange={setBriefOpen}
        onStartNew={handleNewChat}
        messages={briefMessages}
      />
    </div>
  );
}

interface HeaderProps {
  canGenerateBrief: boolean;
  onNewChat: () => void;
  onGenerateBrief: () => void;
  hasMessages: boolean;
}

function Header({
  canGenerateBrief,
  onNewChat,
  onGenerateBrief,
  hasMessages,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-2 px-4 sm:px-6 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="grid size-7 place-items-center rounded-lg bg-foreground text-background shrink-0">
            <SparklesIcon className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium leading-tight">Stitch Talk</p>
            <p className="text-[11px] text-muted-foreground leading-tight truncate">
              Figure out the look before anything gets generated.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {hasMessages && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onNewChat}
              aria-label="Start a new chat"
            >
              <PlusIcon />
              New chat
            </Button>
          )}
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={onGenerateBrief}
            disabled={!canGenerateBrief}
            aria-label="Generate design brief"
            title={
              canGenerateBrief
                ? "Generate the design brief from this conversation"
                : "Have a few exchanges first"
            }
          >
            Generate brief
          </Button>
        </div>
      </div>
    </header>
  );
}

/**
 * Parse a Server-Sent Events body and emit data payloads.
 *
 * Handles:
 *   - `data: <text>` lines (yields the text, skipping `[DONE]`)
 *   - `event: error` lines (paired with a `data:` line via onErrorEvent)
 *   - mid-stream cancellation (caller's AbortController cuts the fetch)
 *
 * The split logic is deliberately lenient: real-world SSE servers can break
 * events across chunks, include CRLF, or have stray whitespace, so we
 * accumulate into a buffer and process complete event blocks only.
 */
async function consumeSseStream(
  body: ReadableStream<Uint8Array>,
  handlers: {
    onDelta: (delta: string) => void;
    onErrorEvent: (message: string) => void;
  }
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let currentEvent: string | null = null;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE events are separated by a blank line (\n\n). Process whatever
    // complete blocks we have, leaving any partial block in the buffer.
    let boundary = buffer.indexOf("\n\n");
    while (boundary !== -1) {
      const rawEvent = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      boundary = buffer.indexOf("\n\n");

      currentEvent = null;
      const dataLines: string[] = [];
      for (const line of rawEvent.split("\n")) {
        if (line.startsWith(":")) continue; // SSE comment
        if (line.startsWith("event:")) {
          currentEvent = line.slice(6).trim();
        } else if (line.startsWith("data:")) {
          // The server emits `data:<payload>` with no space after the colon,
          // so `slice(5)` returns the payload exactly. We must NOT trim — BPE
          // tokens can carry meaningful leading spaces (e.g. " sounds") that
          // would otherwise collapse adjacent tokens.
          dataLines.push(line.slice(5));
        }
      }
      const data = dataLines.join("\n");
      if (!data) continue;
      if (data === "[DONE]") return;
      if (currentEvent === "error") {
        try {
          const parsed = JSON.parse(data) as unknown;
          handlers.onErrorEvent(
            typeof parsed === "string" ? parsed : "Upstream error"
          );
        } catch {
          handlers.onErrorEvent(data);
        }
        continue;
      }
      handlers.onDelta(data);
    }
  }

  // Flush any trailing buffered content (some servers omit the final \n\n).
  // Strip ONLY trailing newlines — leading whitespace is meaningful payload.
  const trailing = buffer.replace(/\n+$/, "");
  if (trailing.length > 0 && trailing !== "[DONE]") {
    handlers.onDelta(trailing);
  }
}