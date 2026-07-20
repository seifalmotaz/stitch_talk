"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon, PlusIcon, SquareIcon } from "lucide-react";

import { fixInlineMarkdown } from "@/lib/markdown-fix";
import { useTRPCClient } from "@/lib/trpc/client";
import type { ChatImage, ChatMessage } from "@/types/chat";
import type { ChatStreamEvents } from "@/types/chat-stream";

import { BriefDialog } from "./BriefDialog";
import { ChatInput } from "./ChatInput";
import { EmptyState } from "./EmptyState";
import { MessageList } from "./MessageList";

export type ChatShellProps = {
  threadId: string;
  projectId: string;
  projectName: string;
  chatTitle: string;
  backHref: string;
  initialMessages: ChatMessage[];
};

/** Persisted chat experience with optimistic streaming state. */
export function ChatShell({
  threadId,
  projectId,
  projectName,
  chatTitle,
  backHref,
  initialMessages,
}: ChatShellProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [briefOpen, setBriefOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef<string | null>(null);
  const router = useRouter();
  const trpcClient = useTRPCClient();

  const userTurnCount = useMemo(
    () => messages.filter((message) => message.role === "user").length,
    [messages],
  );
  const canGenerateBrief = userTurnCount >= 2 && !isStreaming;

  const reconcile = useCallback(async () => {
    const thread = await trpcClient.threads.byId.query({ threadId });
    setMessages(thread.messages);
    router.refresh();
  }, [router, threadId, trpcClient]);

  const createNewThread = useCallback(async () => {
    if (isStreaming) return;
    const thread = await trpcClient.threads.create.mutate({ projectId });
    router.push(`/projects/${projectId}/chats/${thread.id}`);
    router.refresh();
  }, [isStreaming, projectId, router, trpcClient]);

  const stopStreaming = useCallback(() => {
    const requestId = requestIdRef.current;
    abortRef.current?.abort();
    if (requestId) {
      void trpcClient.messages.cancel.mutate({ threadId, requestId });
    }
  }, [threadId, trpcClient]);

  const handleSend = useCallback(
    async (text: string, images: ChatImage[]) => {
      const trimmed = text.trim();
      if ((!trimmed && images.length === 0) || isStreaming) return;

      const requestId = crypto.randomUUID();
      requestIdRef.current = requestId;
      const optimisticUserId = `local-user-${requestId}`;
      const optimisticAssistantId = `local-assistant-${requestId}`;
      const userMessage: ChatMessage = {
        id: optimisticUserId,
        role: "user",
        content: trimmed,
        images: images.length > 0 ? images : undefined,
        createdAt: Date.now(),
      };
      const assistantMessage: ChatMessage = {
        id: optimisticAssistantId,
        role: "assistant",
        content: "",
        createdAt: Date.now(),
        streaming: true,
      };

      setMessages((current) => [...current, userMessage, assistantMessage]);
      setStreamError(null);
      setIsStreaming(true);
      const controller = new AbortController();
      abortRef.current = controller;
      let serverTurnStarted = false;
      let assistantId = optimisticAssistantId;

      try {
        const attachmentIds = await Promise.all(
          images.map((image) => uploadImage(image, threadId, trpcClient)),
        );
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            threadId,
            requestId,
            content: trimmed,
            attachmentIds,
          }),
          signal: controller.signal,
        });
        if (!response.ok || !response.body) {
          const payload = (await response.json().catch(() => null)) as
            | { error?: string }
            | null;
          throw new Error(payload?.error ?? `Chat request failed (${response.status})`);
        }

        await consumeSseStream(response.body, {
          onStart(payload) {
            serverTurnStarted = true;
            assistantId = payload.assistantMessageId;
            setMessages((current) =>
              current.map((message) => {
                if (message.id === optimisticUserId && payload.userMessageId) {
                  return { ...message, id: payload.userMessageId };
                }
                if (message.id === optimisticAssistantId) {
                  return { ...message, id: payload.assistantMessageId };
                }
                return message;
              }),
            );
          },
          onDelta(delta) {
            setMessages((current) =>
              current.map((message) =>
                message.id === assistantId
                  ? { ...message, content: message.content + delta }
                  : message,
              ),
            );
          },
          onError(message) {
            setStreamError(message);
          },
        });
      } catch (error) {
        const cancelled = (error as { name?: string })?.name === "AbortError";
        if (!cancelled) {
          setStreamError(
            error instanceof Error ? error.message : "Something went wrong",
          );
        }
        if (!serverTurnStarted) {
          setMessages((current) =>
            current.filter(
              (message) =>
                message.id !== optimisticUserId &&
                message.id !== optimisticAssistantId,
            ),
          );
        }
      } finally {
        setMessages((current) =>
          current.map((message) =>
            message.id === assistantId
              ? {
                  ...message,
                  content: fixInlineMarkdown(message.content),
                  streaming: false,
                }
              : message,
          ),
        );
        setIsStreaming(false);
        abortRef.current = null;
        requestIdRef.current = null;
        if (serverTurnStarted) {
          await reconcile().catch(() => undefined);
        }
      }
    },
    [isStreaming, reconcile, threadId, trpcClient],
  );

  const handlePickStarter = useCallback(
    (text: string) => void handleSend(text, []),
    [handleSend],
  );
  const hasMessages = messages.length > 0;

  return (
    <div className="atelier">
      <Header
        canGenerateBrief={canGenerateBrief}
        onNewThread={() => void createNewThread()}
        onStop={stopStreaming}
        onGenerateBrief={() => setBriefOpen(true)}
        hasMessages={hasMessages}
        isStreaming={isStreaming}
        projectName={projectName}
        chatTitle={chatTitle}
        backHref={backHref}
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
        onStartNew={() => void createNewThread()}
        threadId={threadId}
      />
    </div>
  );
}

async function uploadImage(
  image: ChatImage,
  threadId: string,
  trpcClient: ReturnType<typeof useTRPCClient>,
) {
  const blob = await fetch(image.dataUrl).then((response) => response.blob());
  const prepared = await trpcClient.attachments.createUpload.mutate({
    threadId,
    originalName: image.name,
    mimeType: image.mimeType as
      | "image/jpeg"
      | "image/png"
      | "image/webp"
      | "image/gif",
    byteSize: blob.size,
  });
  const uploaded = await fetch(prepared.uploadUrl, {
    method: "PUT",
    headers: { "content-type": image.mimeType },
    body: blob,
  });
  if (!uploaded.ok) throw new Error(`Image upload failed (${uploaded.status})`);
  await trpcClient.attachments.completeUpload.mutate({
    attachmentId: prepared.attachmentId,
  });
  return prepared.attachmentId;
}

interface HeaderProps {
  canGenerateBrief: boolean;
  onNewThread: () => void;
  onStop: () => void;
  onGenerateBrief: () => void;
  hasMessages: boolean;
  isStreaming: boolean;
  projectName: string;
  chatTitle: string;
  backHref: string;
}

function Header({
  canGenerateBrief,
  onNewThread,
  onStop,
  onGenerateBrief,
  hasMessages,
  isStreaming,
  projectName,
  chatTitle,
  backHref,
}: HeaderProps) {
  return (
    <header className="atelier-header">
      <div className="atelier-brand">
        <Link
          href={backHref}
          className="atelier-back"
          aria-label={`Back to ${projectName}`}
        >
          <ArrowLeftIcon />
        </Link>
        <div className="atelier-brand-text">
          <p className="atelier-context">{projectName}</p>
          <h1>{chatTitle}</h1>
        </div>
      </div>
      <div className="atelier-actions">
        {isStreaming ? (
          <button type="button" className="btn btn-ghost" onClick={onStop}>
            <SquareIcon />
            <span className="btn-label-hide-sm">Stop</span>
          </button>
        ) : (
          hasMessages && (
            <button type="button" className="btn btn-ghost" onClick={onNewThread}>
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

async function consumeSseStream(
  body: ReadableStream<Uint8Array>,
  handlers: {
    onStart: (payload: ChatStreamEvents["start"]) => void;
    onDelta: (delta: string) => void;
    onError: (message: string) => void;
  },
) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let boundary = buffer.indexOf("\n\n");
    while (boundary >= 0) {
      const raw = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      boundary = buffer.indexOf("\n\n");

      let event = "message";
      const data: string[] = [];
      for (const line of raw.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
      }
      if (data.length === 0) continue;
      let payload: Record<string, unknown>;
      try {
        payload = JSON.parse(data.join("\n")) as Record<string, unknown>;
      } catch {
        handlers.onError("A malformed stream event was ignored.");
        continue;
      }
      if (event === "start") {
        handlers.onStart(payload as ChatStreamEvents["start"]);
      }
      if (event === "delta" && typeof payload.delta === "string") {
        handlers.onDelta(payload.delta);
      }
      if (event === "error") {
        handlers.onError(
          typeof payload.message === "string"
            ? payload.message
            : "Generation failed",
        );
      }
    }
  }
}
