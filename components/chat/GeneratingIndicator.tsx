/**
 * Animated "thinking" indicator — short stitch dashes pulsing along the thread,
 * not the generic three-dot bounce every chat app ships.
 */
export function GeneratingIndicator() {
  return (
    <div
      className="gen-indicator"
      role="status"
      aria-label="Stitch Talk is replying"
    >
      <span className="sr-only">Stitch Talk is typing</span>
      <span className="gen-stitches" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      <span>Pulling the thread…</span>
    </div>
  );
}
