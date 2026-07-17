/**
 * POST /api/brief — generate the final design brief from a transcript.
 *
 * Accepts: { messages: { role, content }[] }
 * Returns: { prompt: string } — a single paragraph ready to paste into Stitch.
 *
 * Non-streaming because the output is short and a single discrete deliverable
 * — a loading spinner is enough UX. If we later want streaming here too, just
 * swap to the same SSE pattern as /api/chat.
 */

import { generateCompletion } from "@/lib/openrouter";
import { BRIEF_SYSTEM_PROMPT } from "@/lib/prompts";
import type { WireMessage } from "@/types/chat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface BriefRequestBody {
  messages?: WireMessage[];
}

function isWireMessage(value: unknown): value is WireMessage {
  return (
    !!value &&
    typeof value === "object" &&
    typeof (value as WireMessage).content === "string" &&
    ((value as WireMessage).role === "user" ||
      (value as WireMessage).role === "assistant")
  );
}

export async function POST(request: Request): Promise<Response> {
  let body: BriefRequestBody;
  try {
    body = (await request.json()) as BriefRequestBody;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const messages = body.messages;
  if (!Array.isArray(messages) || messages.length === 0 || !messages.every(isWireMessage)) {
    return Response.json(
      { error: "Body must include a non-empty `messages` array." },
      { status: 400 }
    );
  }

  try {
    const prompt = await generateCompletion(messages, BRIEF_SYSTEM_PROMPT);
    return Response.json({ prompt: prompt.trim() });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to generate brief";
    return Response.json({ error: message }, { status: 500 });
  }
}