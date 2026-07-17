"use client";

import { SparklesIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  onPick: (text: string) => void;
}

const STARTERS: { label: string; message: string }[] = [
  {
    label: "New app idea",
    message:
      "I'm starting a brand new app from scratch and I have no idea what I want it to look like yet. Help me figure it out.",
  },
  {
    label: "Personal portfolio",
    message:
      "I'm building a personal portfolio site and want it to feel like me, not a template. Where do we start?",
  },
  {
    label: "Refreshing an existing brand",
    message:
      "I have an existing product and want to refresh the visual direction. Help me think through what to change.",
  },
];

/**
 * Shown in the message column when there's no history yet. Greets the user,
 * explains the premise in one line, and offers three starter prompts that
 * prefill the input on click.
 */
export function EmptyState({ onPick }: EmptyStateProps) {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-2xl flex-col items-start gap-6 px-4 sm:px-6 py-16">
        <div className="flex items-center gap-2 text-muted-foreground">
          <span className="grid size-8 place-items-center rounded-lg bg-muted">
            <SparklesIcon className="size-4" />
          </span>
          <span className="text-xs uppercase tracking-wider">Stitch Talk</span>
        </div>

        <div className="space-y-3">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-balance">
            Let&rsquo;s figure out what your design should feel like &mdash;
            before anything gets generated.
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground max-w-xl">
            I&rsquo;ll ask you a few questions about your project, audience, and
            aesthetic, then turn the whole conversation into a single brief
            you can paste into your design tool of choice.
          </p>
        </div>

        <div className="flex flex-col gap-2 w-full">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Or pick a starting point
          </p>
          <div className="flex flex-wrap gap-2">
            {STARTERS.map((s) => (
              <Button
                key={s.label}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onPick(s.message)}
                className="rounded-full"
              >
                {s.label}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}