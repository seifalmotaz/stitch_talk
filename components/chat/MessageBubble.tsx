"use client";

import { memo } from "react";
import { Streamdown } from "streamdown";

import type { ChatMessage } from "@/types/chat";
import { cn } from "@/lib/utils";
import { GeneratingIndicator } from "./GeneratingIndicator";

interface MessageBubbleProps {
  message: ChatMessage;
}

/**
 * Render a single chat message.
 *
 * User messages render as plain text — we don't trust user-typed markdown for
 * v0.1 (also matches what most chat apps do). Assistant messages render via
 * Streamdown, which handles incomplete markdown tokens gracefully during
 * streaming (no flash of half-rendered bold/headers/lists as tokens arrive).
 */
function MessageBubbleImpl({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

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