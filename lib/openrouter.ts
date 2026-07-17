/**
 * Thin wrapper around the official `@openrouter/sdk`.
 *
 * Why the SDK instead of a raw fetch / OpenAI-compat client?
 *   - Native SSE streaming via `EventStream<ChatStreamChunk>` (it's a
 *     ReadableStream subclass with an async iterator).
 *   - Full TypeScript types for `ChatRequest` and `ChatStreamChunk` so we
 *     don't have to hand-roll type guards.
 *   - One consistent surface for streaming + non-streaming + future endpoints.
 *
 * We expose exactly two operations: `streamChat` for the running assistant
 * reply and `generateCompletion` for the brief-generation call. Anything
 * more elaborate belongs at the call site.
 */

import { OpenRouter } from "@openrouter/sdk";
import type { ChatStreamChunk } from "@openrouter/sdk/models/chatstreamchunk";
import type { WireMessage } from "@/types/chat";

const APP_REFERER = "https://stitch-talk.local";
const APP_TITLE = "Stitch Talk";

function getClient(): OpenRouter {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENROUTER_API_KEY is not set. Add it to .env.local — see .env.local.example."
    );
  }
  return new OpenRouter({
    apiKey,
    httpReferer: APP_REFERER,
    appTitle: APP_TITLE,
  });
}

function getModel(): string {
  const model = process.env.OPENROUTER_MODEL;
  if (!model) {
    throw new Error(
      "OPENROUTER_MODEL is not set. Add it to .env.local — see .env.local.example."
    );
  }
  return model;
}

function toChatMessages(
  messages: WireMessage[],
  systemPrompt: string
): Array<{ role: "system" | "user" | "assistant"; content: string }> {
  return [
    { role: "system", content: systemPrompt },
    ...messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  ];
}

/**
 * Stream a chat completion, yielding each text delta as it arrives.
 *
 * Uses `client.chat.send({ chatRequest: { stream: true } })`, which returns
 * an `EventStream<ChatStreamChunk>` (a ReadableStream subclass). We iterate
 * it with `for await` and emit only the `delta.content` field — the SDK
 * handles SSE framing internally.
 */
export async function* streamChat(
  messages: WireMessage[],
  systemPrompt: string
): AsyncGenerator<string, void, void> {
  const client = getClient();
  const model = getModel();

  const stream = await client.chat.send({
    chatRequest: {
      model,
      stream: true,
      messages: toChatMessages(messages, systemPrompt),
    },
  });

  // The SDK returns `SendChatCompletionRequestResponse` (a discriminated
  // union) at the type level, but at runtime it's `EventStream<ChatStreamChunk>`
  // when stream:true. The cast is the type system's gap, not a runtime lie.
  const eventStream = stream as unknown as AsyncIterable<ChatStreamChunk>;
  for await (const chunk of eventStream) {
    const delta = chunk.choices?.[0]?.delta?.content;
    if (delta) yield delta;
  }
}

/**
 * Non-streaming single completion — used for the "Generate Brief" endpoint,
 * which produces one short paragraph and doesn't benefit from token-by-token
 * display.
 *
 * `stream: false` causes `send()` to return a `ChatResult` instead of an
 * EventStream.
 */
export async function generateCompletion(
  messages: WireMessage[],
  systemPrompt: string
): Promise<string> {
  const client = getClient();
  const model = getModel();

  const response = await client.chat.send({
    chatRequest: {
      model,
      stream: false,
      messages: toChatMessages(messages, systemPrompt),
    },
  });

  // Non-streaming shape: ChatResult { choices: [{ message: { content } }] }
  const result = response as unknown as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  return result.choices?.[0]?.message?.content ?? "";
}
