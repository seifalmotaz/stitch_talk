"use client";

import { useEffect, useRef, useState } from "react";

import type { ChatMessage } from "@/types/chat";
import { MessageBubble } from "./MessageBubble";

interface MessageListProps {
  messages: ChatMessage[];
}

/**
 * How close to the bottom the user has to be for us to treat them as
 * "following" the conversation.
 */
const FOLLOW_THRESHOLD_PX = 150;

/**
 * Scrollable message history with follow-the-thread auto-scroll.
 * Instant scrollTop updates (not smooth) so streaming stays snappy.
 */
export function MessageList({ messages }: MessageListProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [isFollowing, setIsFollowing] = useState(true);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const onScroll = () => {
      const dist =
        viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
      setIsFollowing(dist < FOLLOW_THRESHOLD_PX);
    };

    viewport.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => viewport.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || !isFollowing) return;
    viewport.scrollTop = viewport.scrollHeight;
  }, [messages, isFollowing]);

  useEffect(() => {
    if (!isFollowing) return;
    const id = requestAnimationFrame(() => {
      const viewport = viewportRef.current;
      if (!viewport) return;
      viewport.scrollTop = viewport.scrollHeight;
    });
    return () => cancelAnimationFrame(id);
  }, [messages, isFollowing]);

  return (
    <div
      ref={viewportRef}
      data-slot="message-list"
      className="atelier-messages"
      role="log"
      aria-live="polite"
      aria-relevant="additions"
    >
      <div className="atelier-messages-inner">
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
