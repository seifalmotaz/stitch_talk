"use client";

import { useEffect, useRef } from "react";

import type { ChatMessage } from "@/types/chat";
import { MessageBubble } from "./MessageBubble";

interface MessageListProps {
  messages: ChatMessage[];
}

/**
 * Scrollable message history. Auto-scrolls to the latest message when new
 * content arrives, but only if the user is already near the bottom — we don't
 * yank them back if they've intentionally scrolled up to re-read something.
 *
 * We use `useEffect` (not `useLayoutEffect`) because we're inside a client
 * component that may SSR the initial frame, where `useLayoutEffect` would
 * warn. The post-paint scroll is fine for chat UX — the streaming delta is
 * already incremental, so users don't perceive a "jump".
 */
export function MessageList({ messages }: MessageListProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    // Distance from the bottom in pixels. If small, treat the user as
    // "following" the conversation and snap to the bottom.
    const distanceFromBottom =
      viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;

    if (distanceFromBottom < 120) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages]);

  return (
    <div
      ref={viewportRef}
      data-slot="message-list"
      className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6"
    >
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-3 py-6">
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}