"use client";

import { memo } from "react";
import { Streamdown } from "streamdown";

import type { ChatImage, ChatMessage } from "@/types/chat";
import { cn } from "@/lib/utils";
import { GeneratingIndicator } from "./GeneratingIndicator";

interface MessageBubbleProps {
  message: ChatMessage;
}

/**
 * Render a single chat message.
 *
 * User messages render as plain text — we don't trust user-typed markdown for
 * v0.1 (also matches what most chat apps do). Any attached images show as a
 * row of thumbnails above the text. Assistant messages render via Streamdown,
 * which handles incomplete markdown tokens gracefully during streaming (no
 * flash of half-rendered bold/headers/lists as tokens arrive).
 */
function MessageBubbleImpl({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const userImages = isUser ? message.images ?? [] : [];

  return (
    <div
      className={cn(
        "flex w-full",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={cn(
          "max-w-[85%] sm:max-w-[75%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm",
          isUser
            ? "bg-primary text-primary-foreground rounded-br-md"
            : "bg-card text-card-foreground border border-border rounded-bl-md"
        )}
      >
        {userImages.length > 0 && (
          <AttachedImages images={userImages} />
        )}

        {isUser ? (
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        ) : message.content.length === 0 ? (
          <GeneratingIndicator />
        ) : (
          <AssistantMarkdown
            content={message.content}
            error={message.error}
            streaming={!!message.streaming}
          />
        )}
      </div>
    </div>
  );
}

function AttachedImages({ images }: { images: ChatImage[] }) {
  return (
    <div
      role="list"
      aria-label="Attached images"
      className="mb-2 flex flex-wrap gap-1.5"
    >
      {images.map((img, i) => (
        <a
          key={`${img.name ?? "img"}-${i}`}
          role="listitem"
          href={img.dataUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block size-16 sm:size-20 rounded-md overflow-hidden border border-primary-foreground/20 bg-primary-foreground/10 hover:opacity-90 transition-opacity"
          aria-label={img.name ? `Open ${img.name} in new tab` : `Open attachment ${i + 1}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={img.dataUrl}
            alt={img.name ?? `Attachment ${i + 1}`}
            className="size-full object-cover"
          />
        </a>
      ))}
    </div>
  );
}

function AssistantMarkdown({
  content,
  error,
  streaming,
}: {
  content: string;
  error?: boolean;
  streaming: boolean;
}) {
  if (error) {
    return (
      <p className="text-destructive">
        {content || "Something went wrong while generating this reply."}
      </p>
    );
  }
  return (
    <Streamdown
      mode={streaming ? "streaming" : "static"}
      parseIncompleteMarkdown={streaming}
    >
      {content}
    </Streamdown>
  );
}

export const MessageBubble = memo(MessageBubbleImpl);
