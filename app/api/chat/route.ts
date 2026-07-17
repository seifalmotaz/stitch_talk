/**
 * POST /api/chat — streaming chat completion.
 *
 * Accepts: { messages: { role, content }[] }
 * Streams: text/event-stream with `data: <delta>` chunks, terminated by
 *          `data: [DONE]` on success or `event: error\ndata: <msg>` on failure.
 *
 * The client (ChatShell) parses each `data:` line and appends it to the
 * in-flight assistant message.
 */

import { streamChat } from "@/lib/openrouter";
import { CHAT_SYSTEM_PROMPT } from "@/lib/prompts";
import type { WireMessage } from "@/types/chat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ChatRequestBody {
  messages?: WireMessage[];
}

function isWireMessage(value: unknown): value is WireMessage {
  return (
    !!value &&
    typeof value === "object" &&
    (value as WireMessage).role !== undefined &&
    typeof (value as WireMessage).content === "string" &&
    ((value as WireMessage).role === "user" ||
      (value as WireMessage).role === "assistant")
  );
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
  if (!Array.isArray(messages) || messages.length === 0 || !messages.every(isWireMessage)) {
    return new Response(
      JSON.stringify({ error: "Body must include a non-empty `messages` array of {role,content}." }),
      { status: 400, headers: { "content-type": "application/json" } }
    );
  }

  let stream: ReadableStream<Uint8Array>;
  try {
    stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const encoder = new TextEncoder();
        try {
          for await (const delta of streamChat(messages, CHAT_SYSTEM_PROMPT)) {
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