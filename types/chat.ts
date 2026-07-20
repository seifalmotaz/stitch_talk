/**
 * Chat domain types shared between the client and the API routes.
 *
 * The shape is intentionally close to OpenAI/OpenRouter's message format so the
 * server can forward messages with minimal transformation. `id` and `createdAt`
 * are client-only fields used for rendering and persistence.
 */

export type Role = "user" | "assistant" | "system";

/**
 * Image attached to a user message. Stored client-side and sent inline to the
 * model as a base64 data URL. The client resizes to max 1200px on the longest
 * side before storing, so a typical 4 MB phone photo becomes ~200 KB.
 */
export interface ChatImage {
  /** Local preview data URL before upload, then a short-lived signed object URL. */
  dataUrl: string;
  /** Original MIME type (image/png, image/jpeg, image/webp, image/gif). */
  mimeType: string;
  /** Final size in bytes after any client-side resize. */
  size: number;
  /** Optional original filename, used as alt text and in the preview UI. */
  name?: string;
}

export interface ChatMessage {
  id: string;
  role: Role;
  /** Plain-text content. v0.1 only renders markdown for the assistant role. */
  content: string;
  /**
   * Images the user attached with this message. Always empty for assistant
   * messages — the model consumes images as input, never produces them.
   */
  images?: ChatImage[];
  createdAt: number;
  status?: "complete" | "streaming" | "failed" | "cancelled";
  /** Set while the assistant message is still streaming. The server response
   * appends to this in place; the UI renders content as it grows.
   */
  streaming?: boolean;
  /** Set when a message failed to stream — UI shows an inline error state. */
  error?: boolean;
}

/**
 * Wire format sent to /api/chat and /api/brief — strips client-only fields.
 * `images` rides along so the server can build OpenRouter's multimodal
 * content shape.
 */
export type WireMessage = Pick<ChatMessage, "role" | "content" | "images">;
