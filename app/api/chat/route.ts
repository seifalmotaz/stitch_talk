/**
 * POST /api/chat — streaming chat completion.
 *
 * Accepts: { messages: { role, content, images? }[] }
 *   - `content` is the text part of the message.
 *   - `images` is optional. If present, the message becomes multimodal:
 *     `content` stays as the text part, and each image is sent as a
 *     `image_url` part with a base64 data URL.
 * Streams: text/event-stream with `data: <delta>` chunks, terminated by
 *          `data: [DONE]` on success or `event: error\ndata: <msg>` on failure.
 *
 * The client (ChatShell) parses each `data:` line and appends it to the
 * in-flight assistant message.
 */

import { streamChat } from "@/lib/openrouter";
import { fixStreamingMarkdownBoundary } from "@/lib/markdown-fix";
import { CHAT_SYSTEM_PROMPT } from "@/lib/prompts";
import type { ChatImage, WireMessage } from "@/types/chat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ChatRequestBody {
  messages?: WireMessage[];
}

// Per-message image limits. The client also enforces these before sending
// (max 4 images, max 5MB each after resize) — server validation is
// defense in depth.
const MAX_IMAGES_PER_MESSAGE = 4;
const ALLOWED_IMAGE_MIME_PREFIXES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const DATA_URL_RE = /^data:([^;]+);base64,/;

function isValidImage(img: unknown): img is ChatImage {
  if (!img || typeof img !== "object") return false;
  const i = img as ChatImage;
  if (typeof i.dataUrl !== "string" || !i.dataUrl.startsWith("data:")) return false;
  const m = i.dataUrl.match(DATA_URL_RE);
  if (!m) return false;
  if (!ALLOWED_IMAGE_MIME_PREFIXES.includes(m[1])) return false;
  if (typeof i.size !== "number" || i.size <= 0 || i.size > 8 * 1024 * 1024) return false;
  return true;
}

function isWireMessage(value: unknown): value is WireMessage {
  if (!value || typeof value !== "object") return false;
  const m = value as WireMessage;
  if (m.role !== "user" && m.role !== "assistant") return false;
  if (typeof m.content !== "string") return false;
  if (m.images !== undefined) {
    if (!Array.isArray(m.images)) return false;
    if (m.images.length > MAX_IMAGES_PER_MESSAGE) return false;
    if (!m.images.every(isValidImage)) return false;
  }
  return true;
}

function sseEncode(payload: string): string {
  // SSE spec allows either `data: <value>` or `data:<value>` — the space is
  // considered part of the value. We omit it so the payload round-trips
  // byte-for-byte; otherwise every chunk would carry a phantom leading space
  // that breaks token concatenation downstream (e.g. BPE tokens like
  // " sounds" become "  sounds" after framing).
  return `data:${payload}\n\n`;
}

export async function POST(request: Request): Promise<Response> {
  let body: ChatRequestBody;
  try {
    body = (await request.json()) as ChatRequestBody;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const messages = body.messages;
  if (
    !Array.isArray(messages) ||
    messages.length === 0 ||
    !messages.every(isWireMessage)
  ) {
    return new Response(
      JSON.stringify({
        error: `Body must include a non-empty messages array. Each message needs role (user|assistant), content (string), and optional images (array of {dataUrl, size, mimeType}, max ${MAX_IMAGES_PER_MESSAGE}, each ≤ 8MB, data URL with image/{jpeg,png,webp,gif}).`,
      }),
      { status: 400, headers: { "content-type": "application/json" } }
    );
  }

  let stream: ReadableStream<Uint8Array>;
  try {
    stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const encoder = new TextEncoder();
        // Accumulated text so the boundary-fix helper can decide whether to
        // prepend a paragraph break to each incoming delta.
        let accumulated = "";
        try {
          for await (const rawDelta of streamChat(messages, CHAT_SYSTEM_PROMPT)) {
            const delta = fixStreamingMarkdownBoundary(accumulated, rawDelta);
            accumulated += delta;
            controller.enqueue(encoder.encode(sseEncode(delta)));
          }
          controller.enqueue(encoder.encode(sseEncode("[DONE]")));
          controller.close();
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "Unknown upstream error";
          // Emit a structured error event the client can surface inline.
          controller.enqueue(
            encoder.encode(`event: error\ndata: ${JSON.stringify(message)}\n\n`)
          );
          controller.enqueue(encoder.encode(sseEncode("[DONE]")));
          controller.close();
        }
      },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to start chat stream";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      // Disable nginx-style buffering if the app is behind a proxy.
      "x-accel-buffering": "no",
      connection: "keep-alive",
    },
  });
}
