/**
 * Thin wrapper around the OpenAI SDK pointed at OpenRouter.
 *
 * Why OpenAI SDK instead of a dedicated OpenRouter client?
 *   OpenRouter is OpenAI-compatible — same request/response shape — and the
 *   OpenAI SDK is the most battle-tested streaming client in the Node ecosystem.
 *   We only need two operations: stream a chat completion, and produce a single
 *   non-streaming completion. Anything more elaborate belongs at the call site.
 */

import OpenAI from "openai";
import type { WireMessage } from "@/types/chat";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

function getClient(): OpenAI {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENROUTER_API_KEY is not set. Add it to .env.local — see .env.local.example."
    );
  }
  return new OpenAI({
    apiKey,
    baseURL: OPENROUTER_BASE_URL,
    defaultHeaders: {
      // OpenRouter recommends identifying your app so it can show up in their
      // dashboard and ranking. Safe to leave generic for local dev.
      "HTTP-Referer": "https://stitch-talk.local",
      "X-Title": "Stitch Talk",
    },
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
 * Stream a chat completion, yielding each text delta as it arrives.
 *
 * Yields plain strings — the caller concatenates them. We strip OpenAI's
 * `choices[0].finish_reason` and tool-call metadata; v0.1 doesn't use them.
 */
export async function* streamChat(
  messages: WireMessage[],
  systemPrompt: string
): AsyncGenerator<string, void, void> {
  const client = getClient();
  const model = getModel();

  const stream = await client.chat.completions.create({
    model,
    stream: true,
    messages: [{ role: "system", content: systemPrompt }, ...messages],
  });

  for await (const chunk of stream) {
    const delta = chunk.choices?.[0]?.delta?.content;
    if (delta) yield delta;
  }
}

/**
 * Non-streaming single completion — used for the "Generate Brief" endpoint,
 * which produces one short paragraph and doesn't benefit from token-by-token
 * display.
 */
export async function generateCompletion(
  messages: WireMessage[],
  systemPrompt: string
): Promise<string> {
  const client = getClient();
  const model = getModel();

  const response = await client.chat.completions.create({
    model,
    stream: false,
    messages: [{ role: "system", content: systemPrompt }, ...messages],
  });

  return response.choices?.[0]?.message?.content ?? "";
}