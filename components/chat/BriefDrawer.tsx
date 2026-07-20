"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CheckIcon, CopyIcon, XIcon } from "lucide-react";

import type { BriefCardData } from "@/types/chat";

interface BriefDrawerProps {
  /** All brief versions saved in this thread, newest first. The drawer
   *  renders a "Versions" list at the bottom from this array. */
  briefs: BriefCardData[];
  /** The brief currently in focus. Drives the body and the version-pill
   *  highlight; clicking a different version switches focus. */
  activeId: string | null;
  onClose: () => void;
  onSelect: (briefId: string) => void;
}

/**
 * Right-side pane rendered next to the chat thread — NOT a modal overlay.
 * The chat list stays visible on the left and scrollable; this pane
 * occupies its own flex column on the right. Both panes share viewport
 * height.
 *
 * Layout & behavior:
 *   - The brief body, gaps, copy button, and versions list live here.
 *   - ESC closes (preserves parity with the modal sheets elsewhere).
 *   - Focus moves to the close button on mount and back to the trigger on
 *     unmount, so keyboard users always know where they are.
 *   - No scrim — there's nothing dimming behind the pane, so it's safe to
 *     keep the chat interactive in parallel.
 */
export function BriefDrawer({ briefs, activeId, onClose, onSelect }: BriefDrawerProps) {
  const [copied, setCopied] = useState(false);
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  const active = briefs.find((brief) => brief.id === activeId) ?? briefs[0] ?? null;

  useEffect(() => {
    if (!active) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const timer = window.setTimeout(() => closeRef.current?.focus(), 0);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("keydown", onKey);
      previouslyFocused.current?.focus?.();
    };
  }, [active, onClose]);

  // Reset the "Copied" pill whenever the active brief changes.
  useEffect(() => {
    setCopied(false);
  }, [active?.id]);

  if (!active) return null;

  const handleCopy = async () => {
    if (!active) return;
    try {
      await navigator.clipboard.writeText(active.prompt);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Older browsers lack a clipboard API — the body is a plain <pre>,
      // so we can't select a fallback. No-op is the lesser evil.
    }
  };

  return (
    <aside
      className="drawer-pane"
      aria-labelledby={titleId}
    >
      <button
        ref={closeRef}
        type="button"
        className="modal-close drawer-close"
        onClick={onClose}
        aria-label="Close brief"
      >
        <XIcon />
      </button>

      <p className="modal-kicker">Design brief</p>
      <h2 id={titleId} className="drawer-title">
        Brief <span className="drawer-title-version">v{active.version}</span>
      </h2>
      <p className="drawer-stamp">
        {formatAbsolute(active.createdAt)} · based on the conversation so far
      </p>

      {briefs.length > 1 && (
        <div
          className="drawer-version-bar"
          role="tablist"
          aria-label="Brief versions"
        >
          {briefs.map((brief) => {
            const isActive = brief.id === active.id;
            return (
              <button
                key={brief.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={`drawer-version-tab${
                  isActive ? " drawer-version-tab--active" : ""
                }`}
                onClick={() => onSelect(brief.id)}
                aria-label={`Open brief v${brief.version}`}
              >
                v{brief.version}
              </button>
            );
          })}
        </div>
      )}

      <div className="drawer-body">
        <pre className="brief-body" aria-label={`Brief v${active.version} content`}>
          {active.prompt}
        </pre>

        {active.gaps.length > 0 && (
          <div className="brief-gaps">
            <h3>Worth pinning down before you paste this</h3>
            <ul>
              {active.gaps.map((gap, index) => (
                <li key={`${gap}-${index}`}>{gap}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="drawer-footer">
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => void handleCopy()}
          aria-label="Copy brief"
        >
          {copied ? <CheckIcon /> : <CopyIcon />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </aside>
  );
}

function formatAbsolute(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
