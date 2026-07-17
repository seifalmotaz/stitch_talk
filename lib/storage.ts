/**
 * localStorage persistence for chat history.
 *
 * Versioned key (`:v1`) so we can migrate the schema in v0.15/v0.2 without
 * trampling older sessions. All reads are defensive — corrupted JSON or a
 * quota error both degrade gracefully to "no history" rather than crashing
 * the page.
 */

import type { ChatMessage } from "@/types/chat";

const STORAGE_KEY = "stitch-talk:chat-history:v1";

/** True when localStorage is reachable. False during SSR or in private modes. */
function hasStorage(): boolean {
  try {
    return typeof window !== "undefined" && !!window.localStorage;
  } catch {
    return false;
  }
}

export function loadMessages(): ChatMessage[] {
  if (!hasStorage()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Lightweight shape guard — drop anything that obviously isn't a message.
    // We don't deeply validate because future versions may add fields.
    return parsed.filter(
      (m): m is ChatMessage =>
        m &&
        typeof m === "object" &&
        typeof m.id === "string" &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string"
    );
  } catch {
    return [];
  }
}

export function saveMessages(messages: ChatMessage[]): void {
  if (!hasStorage()) return;
  try {
    // Strip transient flags before persisting — `streaming` is meaningless
    // after a reload and `error` shouldn't survive across sessions.
    const sanitized = messages.map(
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      ({ streaming: _streaming, error: _error, ...rest }) => rest
    );
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
  } catch {
    // Quota exceeded or storage disabled — silent fail is fine for v0.1.
  }
}

export function clearMessages(): void {
  if (!hasStorage()) return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}