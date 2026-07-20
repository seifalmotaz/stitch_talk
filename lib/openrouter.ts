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
 *
 * Multimodal: user messages with attached images are transformed into
 * OpenRouter's content-array shape (text part + image_url parts). The
 * model consumes images as input — it never produces them — so only user
 * messages need the array form. Assistant messages stay as plain strings.
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

/**
 * Build the messages array we send to OpenRouter.
 *
 * - System message is always plain text.
 * - User messages with no images stay as plain text (cheaper for models
 *   and matches the well-trodden code path).
 * - User messages WITH images become a content array: a text part followed
 *   by one image_url part per image. The order is text-then-images so the
 *   model's attention sees the user's question/observation first.
 * - Assistant messages are always plain text.
 *
 * Note: the SDK's TypeScript types use camelCase `imageUrl` (the SDK
 * serializes to `image_url` on the wire). We use camelCase here to satisfy
 * the type checker; OpenRouter accepts both forms.
 *
 * The SDK narrows the messages array to a discriminated union by role. We
 * build with a relaxed local type and cast at the boundary — the runtime
 * shape is exactly what OpenRouter expects.
 */
function toChatMessages(
  messages: WireMessage[],
  systemPrompt: string
): Array<{ role: string; content: unknown }> {
  const out: Array<{ role: string; content: unknown }> = [
    { role: "system", content: systemPrompt },
  ];
  for (const m of messages) {
    if (m.role === "user" && m.images && m.images.length > 0) {
      out.push({
        role: "user",
        content: [
          { type: "text", text: m.content },
          ...m.images.map((img) => ({
            type: "image_url",
            imageUrl: { url: img.dataUrl },
          })),
        ],
      });
    } else {
      out.push({
        role: m.role,
        content: m.content,
      });
    }
  }
  return out;
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
  systemPrompt: string,
  signal?: AbortSignal,
): AsyncGenerator<string, void, void> {
  const client = getClient();
  const model = getModel();

  const stream = await client.chat.send(
    {
      chatRequest: {
        model,
        stream: true,
        // The SDK's ChatMessages type is a discriminated union by role that
        // doesn't capture our richer multimodal shape at the type level. The
        // runtime payload is exactly what OpenRouter expects (string content
        // for text, array of {type,text|imageUrl} parts for multimodal).
        messages: toChatMessages(messages, systemPrompt) as never,
        // Enable high reasoning effort for reasoning models (e.g. Gemma 4 31B)
        reasoning: {
          effort: "high",
        },
      },
    },
    { signal },
  );

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
 * Non-streaming single completion — used for the "Generate Brief" endpoint.
 *
 * Two modes:
 *   - Default (no responseFormat): returns the raw string content. Used for
 *     simple completions where we just want the model's text back.
 *   - With `responseFormat: { type: "json_object" }`: instructs the model to
 *     emit valid JSON, then parses the response into a typed object. Used
 *     by the brief endpoint to extract `prompt` + `gaps` cleanly.
 */
export async function generateCompletion(
  messages: WireMessage[],
  systemPrompt: string,
  options: { responseFormat?: { type: "json_object" } } = {}
): Promise<string> {
  const client = getClient();
  const model = getModel();

  const response = await client.chat.send({
    chatRequest: {
      model,
      stream: false,
      // See note in streamChat above about why we cast to `never`.
      messages: toChatMessages(messages, systemPrompt) as never,
      ...(options.responseFormat
        ? { responseFormat: options.responseFormat }
        : {}),
      // Enable high reasoning effort for reasoning models (e.g. Gemma 4 31B)
      reasoning: {
        effort: "high",
      },
    } as never,
  });

  // Non-streaming shape: ChatResult { choices: [{ message: { content } }] }
  const result = response as unknown as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  return result.choices?.[0]?.message?.content ?? "";
}
