"use client";

import { memo } from "react";
import { Streamdown } from "streamdown";

import type { BriefCardData, ChatImage, ChatMessage } from "@/types/chat";
import { BriefCard } from "./BriefCard";
import { GeneratingIndicator } from "./GeneratingIndicator";

interface MessageBubbleProps {
  message: ChatMessage;
  onOpenBrief: (brief: BriefCardData) => void;
}

/**
 * Single message on the conversation thread.
 *
 * Assistant replies read as editorial design notes (serif, full-width card).
 * User turns read as annotations / sticky notes pulled to the right.
 * A knot on the left spine marks each entry on the continuous stitch line.
 */
function MessageBubbleImpl({ message, onOpenBrief }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const userImages = isUser ? (message.images ?? []) : [];
  const briefs = !isUser ? (message.briefs ?? []) : [];

  return (
    <article
      className={`message ${isUser ? "message--user" : "message--assistant"}`}
      aria-label={isUser ? "Your message" : "Stitch Talk reply"}
    >
      <div className="message-knot" aria-hidden="true" />
      <div className="message-body">
        <div className="message-meta">
          <span>{isUser ? "You" : "Stitch Talk"}</span>
        </div>
        <div className="message-card">
          {userImages.length > 0 && <AttachedImages images={userImages} />}

          {isUser ? (
            <p className="message-text">{message.content}</p>
          ) : message.error ? (
            <AssistantMarkdown
              content={message.content}
              error
              streaming={false}
            />
          ) : message.content.length === 0 ? (
            <GeneratingIndicator />
          ) : (
            <AssistantMarkdown
              content={message.content}
              streaming={!!message.streaming}
            />
          )}

          {briefs.length > 0 && (
            <div className="brief-card-row" role="list" aria-label="Brief versions saved in this turn">
              {briefs.map((brief) => (
                <BriefCard
                  key={brief.id}
                  brief={brief}
                  onOpen={onOpenBrief}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function AttachedImages({ images }: { images: ChatImage[] }) {
  return (
    <div role="list" aria-label="Attached images" className="message-images">
      {images.map((img, i) => (
        <a
          key={`${img.name ?? "img"}-${i}`}
          role="listitem"
          href={img.dataUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={
            img.name ? `Open ${img.name} in new tab` : `Open attachment ${i + 1}`
          }
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={img.dataUrl}
            alt={img.name ?? `Attachment ${i + 1}`}
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
      <p className="message-error">
        {content || "Something went wrong while generating this reply."}
      </p>
    );
  }
  return (
    <div className="st-md">
      <Streamdown
        mode={streaming ? "streaming" : "static"}
        parseIncompleteMarkdown={streaming}
      >
        {content}
      </Streamdown>
    </div>
  );
}

export const MessageBubble = memo(MessageBubbleImpl);
