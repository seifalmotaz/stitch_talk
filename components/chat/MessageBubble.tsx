"use client";

import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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
 * v0.1 (also matches what most chat apps do). Assistant messages render
 * markdown via react-markdown, with a Tailwind-typography-flavoured styling.
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
          <AssistantMarkdown content={message.content} error={message.error} />
        )}
      </div>
    </div>
  );
}

function AssistantMarkdown({ content, error }: { content: string; error?: boolean }) {
  if (error) {
    return (
      <p className="text-destructive">
        {content || "Something went wrong while generating this reply."}
      </p>
    );
  }
  return (
    <div className="prose-chat">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Tighten the prose for chat density.
          p: ({ children }) => (
            <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="my-2 list-disc pl-5 space-y-1">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="my-2 list-decimal pl-5 space-y-1">{children}</ol>
          ),
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          strong: ({ children }) => (
            <strong className="font-semibold">{children}</strong>
          ),
          em: ({ children }) => <em className="italic">{children}</em>,
          code: ({ children }) => (
            <code className="rounded bg-muted px-1 py-0.5 text-xs font-mono">
              {children}
            </code>
          ),
          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-primary/80"
            >
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export const MessageBubble = memo(MessageBubbleImpl);