"use client";

import { memo } from "react";
import { FileTextIcon } from "lucide-react";

import type { BriefCardData } from "@/types/chat";

interface BriefCardProps {
  brief: BriefCardData;
  onOpen: (brief: BriefCardData) => void;
}

/**
 * One inline "Brief · v2" card inside an assistant message. Tapping it hands
 * the brief to the parent (ChatShell) which opens the right-side drawer.
 *
 * The card is intentionally small — a clickable chip rather than a full
 * preview. The drawer carries the full content. Multiple cards stack on the
 * same row when a single assistant turn saves more than one version.
 */
function BriefCardImpl({ brief, onOpen }: BriefCardProps) {
  const created = new Date(brief.createdAt);
  const stamp = formatRelative(created);

  return (
    <button
      type="button"
      className="brief-card"
      onClick={() => onOpen(brief)}
      aria-label={`Open brief v${brief.version}`}
    >
      <span className="brief-card-icon" aria-hidden="true">
        <FileTextIcon />
      </span>
      <span className="brief-card-meta">
        <span className="brief-card-title">
          Brief <span className="brief-card-dot">·</span> v{brief.version}
        </span>
        <span className="brief-card-subtitle">{stamp}</span>
      </span>
    </button>
  );
}

/**
 * "Just now" / "2m ago" / "Mar 14". Short, no seconds, no years — the drawer
 * shows the full timestamp.
 */
function formatRelative(date: Date, now: Date = new Date()): string {
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.round(diffMs / 60_000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHrs = Math.round(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export const BriefCard = memo(BriefCardImpl);
