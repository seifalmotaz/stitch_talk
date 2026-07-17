"use client";

import { useEffect, useRef, useState } from "react";

import type { ChatMessage } from "@/types/chat";
import { MessageBubble } from "./MessageBubble";

interface MessageListProps {
  messages: ChatMessage[];
}

/**
 * How close to the bottom the user has to be for us to treat them as
 * "following" the conversation. Smaller = stricter (user must be near the
 * bottom for auto-scroll). Bigger = more forgiving.
 */
const FOLLOW_THRESHOLD_PX = 150;

/**
 * Scrollable message history.
 *
 * Auto-scrolls to the latest content while the user is "following" (i.e.
 * they're near the bottom of the list). If they scroll up to re-read
 * something, we stop yanking them back. As soon as they scroll down within
 * `FOLLOW_THRESHOLD_PX` of the bottom, auto-scroll resumes.
 *
 * Implementation notes:
 *   - We use INSTANT scroll (`scrollTop = scrollHeight`), not smooth
 *     `scrollIntoView`. Smooth scroll queues and lags during fast streaming.
 *   - We track `isFollowing` via a real scroll listener, not by re-measuring
 *     on every render. That way a chunk arriving between user-scroll events
 *     doesn't suddenly decide "they're not following" based on stale state.
 *   - The hook starts with `isFollowing = true` so the initial render of a
 *     long stored transcript snaps to the latest message.
 */
export function MessageList({ messages }: MessageListProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [isFollowing, setIsFollowing] = useState(true);

  // Track follow-state on scroll. Listener is passive so it doesn't fight
  // the scroll thread.
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const onScroll = () => {
      const dist =
        viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
      setIsFollowing(dist < FOLLOW_THRESHOLD_PX);
    };

    viewport.addEventListener("scroll", onScroll, { passive: true });
    // Run once on mount so the initial state is accurate (covers the case
    // where the browser restored a non-zero scrollTop on reload).
    onScroll();
    return () => viewport.removeEventListener("scroll", onScroll);
  }, []);

  // Whenever messages change, snap to bottom if the user is following.
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || !isFollowing) return;
    viewport.scrollTop = viewport.scrollHeight;
  }, [messages, isFollowing]);

  // Belt-and-suspenders: after the browser lays out the new content (e.g.
  // during a fast streaming burst), run a second scroll on the next frame
  // so the final height is honored.
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