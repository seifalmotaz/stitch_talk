"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeftIcon, PlusIcon } from "lucide-react";

import { fixInlineMarkdown } from "@/lib/markdown-fix";
import { clearMessages, loadMessages, saveMessages } from "@/lib/storage";
import type { ChatImage, ChatMessage, WireMessage } from "@/types/chat";

import { BriefDialog } from "./BriefDialog";
import { ChatInput } from "./ChatInput";
import { EmptyState } from "./EmptyState";
import { MessageList } from "./MessageList";

export type ChatShellProps = {
  /** Project this thread belongs to (for chrome / back link). */
  projectId?: string;
  projectName?: string;
  chatTitle?: string;
  /** Where the back control returns — typically the project hub. */
  backHref?: string;
};

/**
 * The whole chat experience. Owns:
 *   - the message list (loaded from / saved to localStorage)
 *   - the streaming request lifecycle for chat completions
 *   - the brief-generation request lifecycle
 *   - the brief dialog open state
 *
 * Everything else is a presentational child.
 */
export function ChatShell({
  projectId,
  projectName,
  chatTitle,
  backHref,
}: ChatShellProps = {}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [briefOpen, setBriefOpen] = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- hydrate after SSR */
    const stored = loadMessages().map((m) =>
      m.role === "assistant" ? { ...m, content: fixInlineMarkdown(m.content) } : m
    );
    setMessages(stored);
    setHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveMessages(messages);
  }, [messages, hydrated]);

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
    async (text: string, images: ChatImage[]) => {
      const trimmed = text.trim();
      if ((!trimmed && images.length === 0) || isStreaming) return;

      setStreamError(null);

      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: trimmed,
        images: images.length > 0 ? images.slice() : undefined,
        createdAt: Date.now(),
      };

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
          ...(m.images && m.images.length > 0 ? { images: m.images } : {}),
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
          prev.map((m) => {
            if (m.id !== assistantId) return m;
            const cleaned = fixInlineMarkdown(m.content);
            return cleaned === m.content
              ? { ...m, streaming: false }
              : { ...m, content: cleaned, streaming: false };
          })
        );
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [isStreaming, messages]
  );

  const handlePickStarter = useCallback(
    (text: string) => {
      void handleSend(text, []);
    },
    [handleSend]
  );

  const briefMessages = useMemo<WireMessage[]>(
    () => messages.map((m) => ({ role: m.role, content: m.content })),
    [messages]
  );

  const hasMessages = messages.length > 0;

  return (
    <div className="atelier">
      <Header
        canGenerateBrief={canGenerateBrief}
        onNewChat={handleNewChat}
        onGenerateBrief={() => setBriefOpen(true)}
        hasMessages={hasMessages}
        projectName={projectName}
        chatTitle={chatTitle}
        backHref={backHref}
        projectId={projectId}
      />

      <main className="atelier-main">
        {streamError && (
          <div role="alert" className="atelier-alert">
            {streamError}
          </div>
        )}

        {hasMessages ? (
          <MessageList messages={messages} />
        ) : (
          <EmptyState onPick={handlePickStarter} />
        )}
      </main>

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
  projectId?: string;
  projectName?: string;
  chatTitle?: string;
  backHref?: string;
}

function Header({
  canGenerateBrief,
  onNewChat,
  onGenerateBrief,
  hasMessages,
  projectId,
  projectName,
  chatTitle,
  backHref,
}: HeaderProps) {
  const inProject = Boolean(projectName && backHref);

  return (
    <header className="atelier-header">
      <div className="atelier-brand">
        {inProject ? (
          <>
            <Link
              href={backHref!}
              className="atelier-back"
              aria-label={`Back to ${projectName}`}
            >
              <ArrowLeftIcon />
            </Link>
            <div className="atelier-brand-text">
              <p className="atelier-context">{projectName}</p>
              <h1>{chatTitle ?? "Thread"}</h1>
            </div>
          </>
        ) : (
          <div className="atelier-brand-text">
            <h1>Stitch Talk</h1>
            <p>Design the feel before anything gets generated.</p>
          </div>
        )}
      </div>
      <div className="atelier-actions">
        {hasMessages && (
          projectId ? (
            <Link
              href={`/projects/${projectId}/chats/new`}
              className="btn btn-ghost"
              aria-label="Start a new thread"
            >
              <PlusIcon />
              <span className="btn-label-hide-sm">New thread</span>
            </Link>
          ) : (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onNewChat}
              aria-label="Start a new chat"
            >
              <PlusIcon />
              <span className="btn-label-hide-sm">New thread</span>
            </button>
          )
        )}
        <button
          type="button"
          className="btn btn-thread"
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
        </button>
      </div>
    </header>
  );
}

/**
 * Parse a Server-Sent Events body and emit data payloads.
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

    let boundary = buffer.indexOf("\n\n");
    while (boundary !== -1) {
      const rawEvent = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      boundary = buffer.indexOf("\n\n");

      currentEvent = null;
      const dataLines: string[] = [];
      for (const line of rawEvent.split("\n")) {
        if (line.startsWith(":")) continue;
        if (line.startsWith("event:")) {
          currentEvent = line.slice(6).trim();
        } else if (line.startsWith("data:")) {
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

  const trailing = buffer.replace(/\n+$/, "");
  if (trailing.length > 0 && trailing !== "[DONE]") {
    handlers.onDelta(trailing);
  }
}
