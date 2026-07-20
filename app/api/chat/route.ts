import { auth } from "@clerk/nextjs/server";
import type {
  ChatStreamEventName,
  ChatStreamEvents,
} from "@/types/chat-stream";
import { z } from "zod";
import {
  chatRequestSchema,
  type ChatRequestInput,
} from "@/server/chat/contract";
import { encodeSseEvent } from "@/server/chat/sse";
import {
  fixInlineMarkdown,
  fixStreamingMarkdownBoundary,
} from "@/lib/markdown-fix";
import { streamChat } from "@/lib/openrouter";
import { CHAT_SYSTEM_PROMPT } from "@/lib/prompts";
import {
  checkpointAssistant,
  finishAssistant,
  loadModelTranscript,
  startTurn,
} from "@/server/dal/messages";
import { ensureAppUser } from "@/server/dal/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const active = await ensureAppUser(userId);
  if (!active) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let input: ChatRequestInput;
  try {
    input = chatRequestSchema.parse(await request.json());
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof z.ZodError
            ? error.issues[0]?.message ?? "Invalid request"
            : "Invalid JSON body",
      },
      { status: 400 },
    );
  }

  let turn: Awaited<ReturnType<typeof startTurn>>;
  try {
    turn = await startTurn(userId, input);
  } catch (error) {
    console.error("Could not start persisted chat turn", error);
    return Response.json(
      { error: "This chat turn could not be started. Please try again." },
      { status: 409 },
    );
  }
  if (!turn) return Response.json({ error: "Thread not found" }, { status: 404 });

  if (!turn.created) {
    if (turn.assistantStatus === "complete") {
      return replayCompletedTurn(turn.assistantMessageId, turn.assistantContent);
    }
    return Response.json(
      { error: "This generation request is already active or finished" },
      { status: 409 },
    );
  }

  const upstreamController = new AbortController();
  let consumerCancelled = false;
  const abortUpstream = () => upstreamController.abort();
  request.signal.addEventListener("abort", abortUpstream, { once: true });

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      let accumulated = "";
      let lastCheckpoint = Date.now();
      const send = <TEvent extends ChatStreamEventName>(
        event: TEvent,
        data: ChatStreamEvents[TEvent],
      ) => {
        if (consumerCancelled) return;
        controller.enqueue(encoder.encode(encodeSseEvent(event, data)));
      };

      send("start", {
        userMessageId: turn.userMessageId,
        assistantMessageId: turn.assistantMessageId,
        requestId: input.requestId,
      });

      try {
        const transcript = await loadModelTranscript(userId, input.threadId);
        if (!transcript) throw new Error("Thread not found");

        for await (const rawDelta of streamChat(
          transcript,
          CHAT_SYSTEM_PROMPT,
          upstreamController.signal,
        )) {
          const delta = fixStreamingMarkdownBoundary(accumulated, rawDelta);
          accumulated += delta;
          send("delta", { delta });

          if (Date.now() - lastCheckpoint >= 750) {
            await checkpointAssistant(
              userId,
              turn.assistantMessageId,
              accumulated,
            );
            lastCheckpoint = Date.now();
          }
        }

        const finalContent = fixInlineMarkdown(accumulated);
        if (!finalContent.trim()) throw new Error("Provider returned an empty response");
        await finishAssistant(userId, turn.assistantMessageId, {
          content: finalContent,
          status: "complete",
        });
        send("done", {
          assistantMessageId: turn.assistantMessageId,
          status: "complete",
        });
      } catch (error) {
        const cancelled = consumerCancelled || upstreamController.signal.aborted;
        await finishAssistant(userId, turn.assistantMessageId, {
          content: fixInlineMarkdown(accumulated),
          status: cancelled ? "cancelled" : "failed",
          errorCode: cancelled ? "cancelled" : "provider_error",
          errorDetail: error instanceof Error ? error.message : "Unknown provider error",
        });
        if (!cancelled) {
          send("error", {
            message: "Stitch Talk could not finish that response. Please try again.",
            retryable: true,
          });
        }
      } finally {
        request.signal.removeEventListener("abort", abortUpstream);
        if (!consumerCancelled) controller.close();
      }
    },
    cancel() {
      consumerCancelled = true;
      upstreamController.abort();
    },
  });

  return new Response(body, { headers: streamHeaders() });
}

function replayCompletedTurn(assistantMessageId: string, content: string) {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          encoder.encode(encodeSseEvent("start", { assistantMessageId, replay: true })),
        );
        if (content) {
          controller.enqueue(encoder.encode(encodeSseEvent("delta", { delta: content })));
        }
        controller.enqueue(
          encoder.encode(encodeSseEvent("done", { assistantMessageId, status: "complete" })),
        );
        controller.close();
      },
    }),
    { headers: streamHeaders() },
  );
}

function streamHeaders() {
  return {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache, no-transform",
    "x-accel-buffering": "no",
    connection: "keep-alive",
  };
}
