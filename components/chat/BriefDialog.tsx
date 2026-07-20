"use client";

import { useMutation } from "@tanstack/react-query";
import { useEffect, useId, useRef, useState } from "react";
import { CheckIcon, CopyIcon, RotateCcwIcon, XIcon } from "lucide-react";
import { useTRPC } from "@/lib/trpc/client";

interface BriefDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStartNew: () => void;
  threadId: string;
}

/** Persisted brief sheet generated from the server-owned transcript. */
export function BriefDialog({
  open,
  onOpenChange,
  onStartNew,
  threadId,
}: BriefDialogProps) {
  const trpc = useTRPC();
  const generateBrief = useMutation(trpc.briefs.generate.mutationOptions());
  const [copied, setCopied] = useState(false);
  const titleId = useId();
  const descId = useId();
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    generateBrief.reset();
    generateBrief.mutate({ threadId });
    // The mutation should run exactly once each time this modal opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, threadId]);

  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const timer = window.setTimeout(() => closeRef.current?.focus(), 0);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onOpenChange(false);
      }
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      previouslyFocused.current?.focus?.();
    };
  }, [open, onOpenChange]);

  const handleCopy = async () => {
    if (!generateBrief.data) return;
    try {
      await navigator.clipboard.writeText(generateBrief.data.prompt);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      document
        .querySelector<HTMLTextAreaElement>('[data-slot="brief-textarea"]')
        ?.select();
    }
  };

  if (!open) return null;

  return (
    <div className="modal-root" role="presentation">
      <button
        type="button"
        className="modal-scrim"
        aria-label="Close brief"
        onClick={() => onOpenChange(false)}
      />
      <div
        className="modal-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
      >
        <button
          ref={closeRef}
          type="button"
          className="modal-close"
          onClick={() => onOpenChange(false)}
          aria-label="Close"
        >
          <XIcon />
        </button>

        <p className="modal-kicker">Design brief</p>
        <h2 id={titleId} className="modal-title">
          Your stitched prompt
        </h2>
        <p id={descId} className="modal-desc">
          One paragraph, ready to paste into Stitch (or wherever you build).
          Tweak it freely — it&rsquo;s a starting point, not a contract.
        </p>

        <div className="modal-body">
          {generateBrief.isPending && (
            <div className="modal-loading">
              <span className="gen-stitches" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
              Distilling your conversation into a brief…
            </div>
          )}

          {generateBrief.error && (
            <div className="modal-error" role="alert">
              {generateBrief.error.message}
            </div>
          )}

          {generateBrief.data && (
            <div>
              <textarea
                data-slot="brief-textarea"
                className="brief-textarea"
                value={generateBrief.data.prompt}
                readOnly
                onFocus={(event) => event.currentTarget.select()}
                aria-label="Generated design brief"
              />
              {generateBrief.data.gaps.length > 0 && (
                <div className="brief-gaps">
                  <h3>Worth pinning down before you paste this</h3>
                  <ul>
                    {generateBrief.data.gaps.map((gap, index) => (
                      <li key={`${gap}-${index}`}>{gap}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer">
          {generateBrief.error && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => generateBrief.mutate({ threadId })}
            >
              Try again
            </button>
          )}
          {generateBrief.data && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => void handleCopy()}
              aria-label="Copy brief"
            >
              {copied ? <CheckIcon /> : <CopyIcon />}
              {copied ? "Copied" : "Copy"}
            </button>
          )}
          <button
            type="button"
            className="btn btn-thread"
            onClick={() => {
              onStartNew();
              onOpenChange(false);
            }}
          >
            <RotateCcwIcon />
            Start a new session
          </button>
        </div>
      </div>
    </div>
  );
}
