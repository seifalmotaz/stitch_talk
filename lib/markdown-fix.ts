/**
 * Streaming markdown safety net.
 *
 * Some models — especially smaller or faster ones — generate markdown that
 * LOOKS formatted (they use **bold** and `1. ` etc.) but collapses every
 * element onto a single line, so the renderer reads it as one paragraph.
 * Examples of the bad pattern:
 *
 *   "...modern leader in the space.**2. Technical-Skeuomorphic**: Using..."
 *   "...architectural precision.Grid** — very clean..."
 *   "...a few directions:-Skeuomorphic** — subtle grids..."
 *
 * We can't fully fix bad markdown, but the most common shapes — sentence-end
 * punctuation immediately followed by a list marker or bolded-capital word,
 * with no blank line in between — are easy to catch. We process each
 * streaming delta as it arrives and prepend a paragraph break where the
 * boundary clearly needs one.
 *
 * The function is moderate-aggressive: it fires on patterns that are
 * unambiguously "should be a new paragraph". The trade-off is occasionally
 * splitting a normal paragraph mid-discussion into two (false positive) vs.
 * leaving the wall-of-text intact (false negative). For chat UX we prefer
 * the former — split paragraphs are still readable, walls of text are not.
 */

/**
 * If the previous text ends in a sentence-ending punctuation AND the new
 * delta starts with a marker (list, bold, or bolded-capital word), prepend
 * a paragraph break to the new delta. Otherwise return it unchanged.
 */
export function fixStreamingMarkdownBoundary(
  prevText: string,
  newDelta: string
): string {
  if (!prevText || !newDelta) return newDelta;

  // Strip any leading whitespace from the new delta so we can pattern-match
  // the real first character. We re-attach it later.
  const leadingWs = newDelta.match(/^\s*/)?.[0] ?? "";
  if (leadingWs.includes("\n")) return newDelta; // already has a break
  const rest = newDelta.slice(leadingWs.length);
  if (!rest) return newDelta;

  const lastChar = prevText[prevText.length - 1];
  const sentenceEnd =
    lastChar === "." ||
    lastChar === "!" ||
    lastChar === "?" ||
    lastChar === '"' ||
    lastChar === ":" ||
    lastChar === ";";

  if (!sentenceEnd) return newDelta;

  // Pattern A: bolded list marker (numbered or bulleted heading)
  //   "**1. Foo**", "**- Foo**", "** Foo**"
  if (/^\*\*(\d+\.|-| )/.test(rest)) return "\n\n" + newDelta;

  // Pattern B: plain numbered list
  //   "1. Foo"
  if (/^\d+\.\s/.test(rest)) return "\n\n" + newDelta;

  // Pattern C: bullet marker followed (with optional space) by a capital letter
  //   "- Foo", "* Foo", "-Foo", "*Foo"  →  typical model-generated list items
  if (/^[-*]\s*[A-Z]/.test(rest)) return "\n\n" + newDelta;

  // Pattern D: bolded phrase starting a new item
  //   "**Foo** continues..." or "**Foo bar:** details..."
  if (/^\*\*[A-Za-z]/.test(rest)) return "\n\n" + newDelta;

  // Pattern E: Capitalized word immediately followed by closing bold
  // (= a new bolded item heading like "Grid** — very clean"). Note: no \b
  // after ** because both * and the following space are non-word chars, so
  // \b doesn't match there.
  if (/^[A-Z][a-z]+\*\*/.test(rest)) return "\n\n" + newDelta;

  // Pattern F: Numbered list marker (optionally with bold or capital heading)
  //   "1. **Bold**"  or  "1. Capital word"  or  "1.**Bold**"
  //   Triggered when previous text ended with sentence punctuation.
  //   This catches the very common model pattern "...disruptor.1. **Swiss/Grid**"
  //   where the "1." starts a new item but is glued to the previous sentence.
  if (/^\d+\.\s*(\*\*|[A-Z])/.test(rest)) return "\n\n" + newDelta;

  return newDelta;
}

/**
 * Full-text cleanup pass — runs once after streaming completes on the
 * accumulated assistant content. Catches inline patterns that span chunk
 * boundaries (which the per-delta fix above can't see). Operates globally
 * via regex so it's O(n) and safe to run on every completed message.
 *
 * Conservative about WHAT we split on:
 *   - We only insert \n\n, never remove characters. Worst case = split one
 *     paragraph into two (still readable).
 *   - We only fire on patterns that look unambiguously like a new list item
 *     or bold heading.
 *
 * Patterns inserted:
 *   `.`**Bold**`         — period immediately followed by bold heading
 *   `:**Bold**`          — colon immediately followed by bold heading
 *   `.`-Foo**`           — period + dash + bold heading
 *   `:`-Foo**`           — colon + dash + bold heading
 *   `.**1. Foo**`        — period + bold numbered list item
 *   `:`**1. Foo**`       — colon + bold numbered list item
 *   `.**- Foo**`         — period + bold bulleted list item
 *   `.`1. Foo`           — period + plain numbered list item
 *   `:`- Foo`            — colon + plain bulleted list item
 *   `.`Foo**             — period + capital word + closing bold (Pattern E
 *                          from the boundary fix, applied globally)
 */
export function fixInlineMarkdown(text: string): string {
  if (!text) return text;

  return (
    text
      // Bolded list marker after sentence punctuation
      //   ".**1. Foo**", ".**- Foo**"
      .replace(/([.!?:;])(?=\*\*\d+\.\s)/g, "$1\n\n")
      .replace(/([.!?:;])(?=\*\*-\s)/g, "$1\n\n")
      // Bolded phrase (likely new section/item heading)
      .replace(/([.!?:;])(?=\*\*[A-Z][a-z])/g, "$1\n\n")
      // Capital word + closing bold (= item heading like "Grid**")
      .replace(/([.!?:;])(?=[A-Z][a-z]+\*\*)/g, "$1\n\n")
      // Plain numbered list — catches "...disruptor.1. **Swiss/Grid**"
      .replace(/([.!?:;])(?=\d+\.\s*(\*\*|[A-Z]))/g, "$1\n\n")
      // Plain bullet
      .replace(/([.!?:;])(?=-\s+[A-Z])/g, "$1\n\n")
      .replace(/([.!?:;])(?=-\s*\*)/g, "$1\n\n")
  );
}
