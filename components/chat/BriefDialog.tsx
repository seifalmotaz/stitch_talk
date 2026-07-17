"use client";

import { useEffect, useState } from "react";
import { CheckIcon, CopyIcon, RotateCcwIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { WireMessage } from "@/types/chat";

interface BriefDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Fired when the user wants to start over after seeing the brief. */
  onStartNew: () => void;
  /** Transcript to distill. Captured at render time — won't auto-refresh if
   * the conversation changes while the dialog is open, which is the behavior
   * we want (the user has clicked "Generate brief" on a snapshot). */
  messages: WireMessage[];
}

type Status =
  | { kind: "loading" }
  | { kind: "ready"; prompt: string }
  | { kind: "error"; message: string };

/**
 * Modal that shows the generated design brief. Handles its own loading /
 * error / ready states. The brief is a single paragraph meant to be copied
 * and pasted elsewhere — the dialog emphasizes copyability (monospace, a
 * dedicated copy button) over visual flourishes.
 */
export function BriefDialog({
  open,
  onOpenChange,
  onStartNew,
  messages,
}: BriefDialogProps) {
  const [status, setStatus] = useState<Status>({ kind: "loading" });
  const [copied, setCopied] = useState(false);

  // Kick off the generation whenever the dialog opens. Reset state on close
  // so the next open is a fresh fetch. The setState calls here are the
  // documented "reset state when a prop changes" pattern; the eslint
  // warning is overly strict for this case.
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
        return (await res.json()) as { prompt?: string };
      })
      .then((data) => {
        if (cancelled) return;
        if (!data.prompt) throw new Error("Empty brief returned from server.");
        setStatus({ kind: "ready", prompt: data.prompt });
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

  const handleCopy = async () => {
    if (status.kind !== "ready") return;
    try {
      await navigator.clipboard.writeText(status.prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard might be unavailable (insecure context). Fall back to
      // selecting the textarea so the user can ⌘+C.
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Your design brief</DialogTitle>
          <DialogDescription>
            One paragraph, ready to paste into Stitch (or wherever you build).
            Tweak it freely &mdash; it&rsquo;s a starting point, not a contract.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-30">
          {status.kind === "loading" && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
              <span className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="size-1.5 rounded-full bg-muted-foreground/60 animate-pulse"
                    style={{ animationDelay: `${i * 150}ms` }}
                  />
                ))}
              </span>
              Distilling your conversation into a brief…
            </div>
          )}

          {status.kind === "error" && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {status.message}
            </div>
          )}

          {status.kind === "ready" && (
            <Textarea
              data-slot="brief-textarea"
              value={status.prompt}
              readOnly
              className="min-h-32 font-mono text-xs leading-relaxed"
              onFocus={(e) => e.currentTarget.select()}
            />
          )}
        </div>

        <DialogFooter>
          {status.kind === "ready" && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopy}
              aria-label="Copy brief"
            >
              {copied ? <CheckIcon /> : <CopyIcon />}
              {copied ? "Copied" : "Copy"}
            </Button>
          )}
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={handleStartNew}
          >
            <RotateCcwIcon />
            Start a new session
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}