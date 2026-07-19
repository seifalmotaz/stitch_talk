"use client";

import { StitchMark } from "./Mark";

interface EmptyStateProps {
  onPick: (text: string) => void;
}

const STARTERS: {
  index: string;
  label: string;
  hint: string;
  message: string;
}[] = [
  {
    index: "01",
    label: "New app idea",
    hint: "Blank canvas. Find the feeling first.",
    message:
      "I'm starting a brand new app from scratch and I have no idea what I want it to look like yet. Help me figure it out.",
  },
  {
    index: "02",
    label: "Personal portfolio",
    hint: "Make it feel like you — not a template.",
    message:
      "I'm building a personal portfolio site and want it to feel like me, not a template. Where do we start?",
  },
  {
    index: "03",
    label: "Brand refresh",
    hint: "Keep the soul. Rewrite the surface.",
    message:
      "I have an existing product and want to refresh the visual direction. Help me think through what to change.",
  },
];

/**
 * First-run landing for the atelier. Editorial hero + three starter "swatches"
 * that kick off a conversation with a single click.
 */
export function EmptyState({ onPick }: EmptyStateProps) {
  return (
    <div className="empty">
      <div className="empty-inner">
        <div className="empty-kicker">
          <span className="empty-kicker-line" aria-hidden="true" />
          <StitchMark />
          <span>Stitch Talk</span>
        </div>

        <h2 className="empty-title">
          Figure out what the design should <em>feel</em> like — before anything
          gets generated.
        </h2>

        <p className="empty-lead">
          I&rsquo;ll ask about your project, audience, and aesthetic, then
          stitch the conversation into a single brief you can paste into your
          design tool of choice.
        </p>

        <p className="empty-label">Start from a thread</p>
        <div className="empty-starters">
          {STARTERS.map((s) => (
            <button
              key={s.label}
              type="button"
              className="starter-card"
              onClick={() => onPick(s.message)}
            >
              <span className="starter-index">{s.index}</span>
              <span className="starter-label">{s.label}</span>
              <span className="starter-hint">{s.hint}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
