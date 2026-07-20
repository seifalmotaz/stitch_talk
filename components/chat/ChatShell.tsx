"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon, FileTextIcon, PlusIcon, SquareIcon } from "lucide-react";

import { fixInlineMarkdown } from "@/lib/markdown-fix";
import { useTRPCClient } from "@/lib/trpc/client";
import type { BriefCardData, ChatImage, ChatMessage } from "@/types/chat";
import type { ChatStreamEvents } from "@/types/chat-stream";

import { BriefDrawer } from "./BriefDrawer";
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

/**
 * Persisted chat experience with optimistic streaming state.
 *
 * Brief versions are produced inline by the chat model (it calls the
 * `save_brief_version` tool whenever the user asks). The server emits a
 * `brief_created` SSE event with the persisted payload, which we attach to
 * the producing assistant message's `briefs[]` and surface as a clickable
 * chip. The right-side drawer opens on chip click to show the full body,
 * gaps, and a versions list for the thread.
 */
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
  const [briefsForThread, setBriefsForThread] = useState<BriefCardData[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeBriefId, setActiveBriefId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef<string | null>(null);
  const router = useRouter();
  const trpcClient = useTRPCClient();

  const reconcile = useCallback(async () => {
    const thread = await trpcClient.threads.byId.query({ threadId });
    setMessages(thread.messages);
    router.refresh();
  }, [router, threadId, trpcClient]);

  /** Load every brief saved in this thread, newest first. Used by the
   *  right-side drawer to render its versions list. New briefs arrive
   *  during the chat session via `brief_created` SSE events and are pushed
   *  into both the message's `briefs[]` array and this top-level list. */
  const loadBriefs = useCallback(async () => {
    const briefs = await trpcClient.briefs.list.query({ threadId });
    setBriefsForThread(briefs);
    return briefs;
  }, [threadId, trpcClient]);

  useEffect(() => {
    void loadBriefs().catch((error) => {
      console.error("[chat] could not load briefs for thread", error);
    });
  }, [loadBriefs]);

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
          onBriefCreated(payload) {
            // Surface the new brief as an inline card on the producing
            // assistant message, mirror it into the drawer's versions
            // list, and open the drawer straight to the new version.
            setMessages((current) =>
              current.map((message) =>
                message.id === assistantId
                  ? {
                      ...message,
                      briefs: [...(message.briefs ?? []), payload.brief],
                    }
                  : message,
              ),
            );
            setBriefsForThread((current) => upsertBrief(current, payload.brief));
            setActiveBriefId(payload.brief.id);
            setDrawerOpen(true);
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

  const openBrief = useCallback((brief: BriefCardData) => {
    setActiveBriefId(brief.id);
    setDrawerOpen(true);
  }, []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  const selectBrief = useCallback((id: string) => setActiveBriefId(id), []);

  /** Open the drawer pinned to the most recent brief in this thread.
   *  Used by the "View latest brief" header button — gives the user a way
   *  back into the drawer after closing it. */
  const openLatestBrief = useCallback(() => {
    if (briefsForThread.length === 0) return;
    setActiveBriefId(briefsForThread[0].id);
    setDrawerOpen(true);
  }, [briefsForThread]);

  const hasMessages = messages.length > 0;
  // The Header keeps the Generate brief button removed — briefs are now
  // produced by the AI when the user asks. The button was the legacy entry
  // point and is gone; the Stop/New actions remain.

  return (
    <div className="atelier">
      <Header
        onNewThread={() => void createNewThread()}
        onStop={stopStreaming}
        onOpenLatestBrief={openLatestBrief}
        latestBriefVersion={briefsForThread[0]?.version ?? null}
        hasMessages={hasMessages}
        isStreaming={isStreaming}
        drawerOpen={drawerOpen}
        projectName={projectName}
        chatTitle={chatTitle}
        backHref={backHref}
      />

      <main className={`atelier-main${drawerOpen ? " atelier-main--with-drawer" : ""}`}>
        <section className="atelier-chat" aria-label="Conversation">
          {streamError && (
            <div role="alert" className="atelier-alert">
              {streamError}
            </div>
          )}
          {hasMessages ? (
            <MessageList messages={messages} onOpenBrief={openBrief} />
          ) : (
            <EmptyState onPick={handlePickStarter} />
          )}

          <ChatInput onSend={handleSend} disabled={isStreaming} />
        </section>

        {drawerOpen && (
          <BriefDrawer
            briefs={briefsForThread}
            activeId={activeBriefId}
            onClose={closeDrawer}
            onSelect={selectBrief}
          />
        )}
      </main>
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

/** Insert or replace a brief by id, keeping newest-first ordering. */
function upsertBrief(current: BriefCardData[], brief: BriefCardData): BriefCardData[] {
  const filtered = current.filter((existing) => existing.id !== brief.id);
  return [brief, ...filtered].sort((a, b) =>
    a.version === b.version
      ? 0
      : a.version > b.version
        ? -1
        : 1,
  );
}

interface HeaderProps {
  onNewThread: () => void;
  onStop: () => void;
  onOpenLatestBrief: () => void;
  latestBriefVersion: number | null;
  hasMessages: boolean;
  isStreaming: boolean;
  drawerOpen: boolean;
  projectName: string;
  chatTitle: string;
  backHref: string;
}

function Header({
  onNewThread,
  onStop,
  onOpenLatestBrief,
  latestBriefVersion,
  hasMessages,
  isStreaming,
  drawerOpen,
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
          <>
            {hasMessages && (
              <button type="button" className="btn btn-ghost" onClick={onNewThread}>
                <PlusIcon />
                <span className="btn-label-hide-sm">New thread</span>
              </button>
            )}
            {latestBriefVersion !== null && !drawerOpen && (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={onOpenLatestBrief}
                aria-label={`Open latest brief, version ${latestBriefVersion}`}
                title="Reopen the most recent brief"
              >
                <FileTextIcon />
                <span className="btn-label-hide-sm">View brief</span>
              </button>
            )}
          </>
        )}
      </div>
    </header>
  );
}

async function consumeSseStream(
  body: ReadableStream<Uint8Array>,
  handlers: {
    onStart: (payload: ChatStreamEvents["start"]) => void;
    onDelta: (delta: string) => void;
    onBriefCreated: (payload: ChatStreamEvents["brief_created"]) => void;
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
      if (event === "brief_created" && typeof payload.brief === "object") {
        handlers.onBriefCreated(payload as unknown as ChatStreamEvents["brief_created"]);
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
