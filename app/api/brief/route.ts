/**
 * POST /api/brief — generate the final design brief from a transcript.
 *
 * Accepts: { messages: { role, content }[] }
 * Returns: { prompt: string, gaps: string[] } — the brief paragraph plus
 *          a short list of things the user should pin down before pasting
 *          into a design tool.
 *
 * Non-streaming because the output is short and a single discrete deliverable
 * — a loading spinner is enough UX. The model is asked for JSON via the
 * `responseFormat` parameter so the brief + gaps come back as a typed object
 * rather than us regexing a free-form reply.
 */

import { auth } from "@clerk/nextjs/server";
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

interface BriefPayload {
  prompt: string;
  gaps: string[];
}

/**
 * Best-effort parse of the model's JSON reply. The SDK guarantees valid JSON
 * when `responseFormat: json_object` is set, but models occasionally wrap
 * the JSON in ``` fences — strip those before parsing.
 */
function parseBriefPayload(raw: string): BriefPayload | null {
  if (!raw) return null;
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  try {
    const parsed = JSON.parse(cleaned) as unknown;
    if (
      parsed &&
      typeof parsed === "object" &&
      typeof (parsed as { prompt?: unknown }).prompt === "string"
    ) {
      const gapsRaw = (parsed as { gaps?: unknown }).gaps;
      const gaps = Array.isArray(gapsRaw)
        ? gapsRaw.filter((g): g is string => typeof g === "string")
        : [];
      return {
        prompt: (parsed as { prompt: string }).prompt.trim(),
        gaps,
      };
    }
  } catch {
    // fall through
  }
  return null;
}

export async function POST(request: Request): Promise<Response> {
  const { isAuthenticated } = await auth();
  if (!isAuthenticated) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

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
    // The brief summarizes text — strip images from messages so the payload
    // stays small. The model already saw the images when it generated the
    // assistant turns, so no information is lost.
    const messagesForBrief: WireMessage[] = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const raw = await generateCompletion(messagesForBrief, BRIEF_SYSTEM_PROMPT, {
      responseFormat: { type: "json_object" },
    });
    const parsed = parseBriefPayload(raw);
    if (!parsed) {
      // Fallback: treat the whole response as the prompt, no gaps. This
      // keeps the UX usable even if the model refuses to emit JSON for
      // some reason.
      return Response.json({ prompt: raw.trim(), gaps: [] });
    }
    return Response.json(parsed);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to generate brief";
    return Response.json({ error: message }, { status: 500 });
  }
}