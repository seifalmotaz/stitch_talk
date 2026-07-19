"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CheckIcon, CopyIcon, RotateCcwIcon, XIcon } from "lucide-react";

import type { WireMessage } from "@/types/chat";

interface BriefDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Fired when the user wants to start over after seeing the brief. */
  onStartNew: () => void;
  /** Transcript snapshot captured when the dialog opens. */
  messages: WireMessage[];
}

interface BriefPayload {
  prompt: string;
  gaps: string[];
}

type Status =
  | { kind: "loading" }
  | { kind: "ready"; prompt: string; gaps: string[] }
  | { kind: "error"; message: string };

/**
 * Printed-brief sheet: distill the conversation into a paste-ready prompt
 * plus gaps worth pinning down. Custom modal — no shadcn Dialog.
 */
export function BriefDialog({
  open,
  onOpenChange,
  onStartNew,
  messages,
}: BriefDialogProps) {
  const [status, setStatus] = useState<Status>({ kind: "loading" });
  const [copied, setCopied] = useState(false);
  const titleId = useId();
  const descId = useId();
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) {
      /* eslint-disable react-hooks/set-state-in-effect -- reset on close */
      setStatus({ kind: "loading" });
      setCopied(false);
      /* eslint-enable react-hooks/set-state-in-effect */
      return;
    }
    let cancelled = false;
    setStatus({ kind: "loading" });
    fetch("/api/brief", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const errText = await res.text().catch(() => "");
          throw new Error(errText || `Brief request failed (${res.status})`);
        }
        return (await res.json()) as Partial<BriefPayload>;
      })
      .then((data) => {
        if (cancelled) return;
        if (!data.prompt) throw new Error("Empty brief returned from server.");
        setStatus({
          kind: "ready",
          prompt: data.prompt,
          gaps: Array.isArray(data.gaps) ? data.gaps : [],
        });
      })
      .catch((err) => {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : "Failed to generate brief";
        setStatus({ kind: "error", message });
      });
    return () => {
      cancelled = true;
    };
  }, [open, messages]);

  // Focus management + Escape + body scroll lock
  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const t = window.setTimeout(() => closeRef.current?.focus(), 0);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onOpenChange(false);
      }
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      previouslyFocused.current?.focus?.();
    };
  }, [open, onOpenChange]);

  const handleCopy = async () => {
    if (status.kind !== "ready") return;
    try {
      await navigator.clipboard.writeText(status.prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      const ta = document.querySelector<HTMLTextAreaElement>(
        '[data-slot="brief-textarea"]'
      );
      ta?.select();
    }
  };

  const handleStartNew = () => {
    onStartNew();
    onOpenChange(false);
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
          {status.kind === "loading" && (
            <div className="modal-loading">
              <span className="gen-stitches" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
              Distilling your conversation into a brief…
            </div>
          )}

          {status.kind === "error" && (
            <div className="modal-error" role="alert">
              {status.message}
            </div>
          )}

          {status.kind === "ready" && (
            <div>
              <textarea
                data-slot="brief-textarea"
                className="brief-textarea"
                value={status.prompt}
                readOnly
                onFocus={(e) => e.currentTarget.select()}
                aria-label="Generated design brief"
              />
              {status.gaps.length > 0 && (
                <div className="brief-gaps">
                  <h3>Worth pinning down before you paste this</h3>
                  <ul>
                    {status.gaps.map((gap, i) => (
                      <li key={i}>{gap}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer">
          {status.kind === "ready" && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={handleCopy}
              aria-label="Copy brief"
            >
              {copied ? <CheckIcon /> : <CopyIcon />}
              {copied ? "Copied" : "Copy"}
            </button>
          )}
          <button
            type="button"
            className="btn btn-thread"
            onClick={handleStartNew}
          >
            <RotateCcwIcon />
            Start a new session
          </button>
        </div>
      </div>
    </div>
  );
}
