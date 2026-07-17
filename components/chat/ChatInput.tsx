"use client";

import { useCallback, useRef, useState } from "react";
import { SendIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface ChatInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

/**
 * Multiline chat input.
 *
 * - Enter sends, Shift+Enter inserts a newline (standard chat UX).
 * - Send button is disabled while empty or while a stream is in flight.
 * - Textarea auto-resizes up to a comfortable cap so the UI doesn't grow
 *   unbounded as users paste in longer thoughts.
 */
export function ChatInput({
  onSend,
  disabled = false,
  placeholder = "Reply to Stitch Talk…",
}: ChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const submit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
    // Reset the auto-sized height back to its baseline.
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [value, disabled, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    // Auto-grow up to ~200px.
    const ta = e.target;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`;
  };

  const canSend = !disabled && value.trim().length > 0;

  return (
    <div className="border-t border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto w-full max-w-2xl px-4 sm:px-6 py-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="flex items-end gap-2"
        >
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
            aria-label="Type your message"
            className="min-h-10 max-h-50 resize-none py-2.5"
          />
          <Button
            type="submit"
            size="icon"
            disabled={!canSend}
            aria-label="Send message"
            className="size-10 shrink-0"
          >
            <SendIcon />
          </Button>
        </form>
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          Enter to send · Shift+Enter for newline
        </p>
      </div>
    </div>
  );
}