/**
 * Animated "thinking" indicator shown in the assistant's column while a
 * message has zero content yet but is streaming. Subtle three-dot pulse.
 */
export function GeneratingIndicator() {
  return (
    <div
      role="status"
      aria-label="Stitch Talk is replying"
      className="flex items-center gap-1 py-1"
    >
      <span className="sr-only">Stitch Talk is typing</span>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="size-1.5 rounded-full bg-muted-foreground/60 animate-pulse"
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </div>
  );
}