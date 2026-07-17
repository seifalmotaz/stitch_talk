/**
 * Chat domain types shared between the client and the API routes.
 *
 * The shape is intentionally close to OpenAI/OpenRouter's message format so the
 * server can forward messages with minimal transformation. `id` and `createdAt`
 * are client-only fields used for rendering and persistence.
 */

export type Role = "user" | "assistant" | "system";

export interface ChatMessage {
  id: string;
  role: Role;
  /** Plain-text content. v0.1 only renders markdown for the assistant role. */
  content: string;
  createdAt: number;
  /**
   * Set while the assistant message is still streaming. The server response
   * appends to this in place; the UI renders content as it grows.
   */
  streaming?: boolean;
  /** Set when a message failed to stream — UI shows an inline error state. */
  error?: boolean;
}

/**
 * Wire format sent to /api/chat and /api/brief — strip the client-only fields.
 */
export type WireMessage = Pick<ChatMessage, "role" | "content">;