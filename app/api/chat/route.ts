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
import { streamChatWithTools } from "@/lib/openrouter";
import { CHAT_SYSTEM_PROMPT } from "@/lib/prompts";
import {
  checkpointAssistant,
  finishAssistant,
  loadModelTranscript,
  startTurn,
} from "@/server/dal/messages";
import { ensureAppUser } from "@/server/dal/users";
import { recordBriefFromChat } from "@/server/dal/briefs";

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

        const chatStream = streamChatWithTools(
          transcript,
          CHAT_SYSTEM_PROMPT,
          [
            {
              name: "save_brief_version",
              description:
                "Persists a new version of the design brief based on the current conversation. Call only when the user EXPLICITLY asks for a brief version to be saved (e.g. 'save a brief', 'lock in a version', 'snapshot this', 'give me a brief'). Do not call on your own initiative. Always emit a one-line text status to the user BEFORE invoking the tool — saving a brief takes a few seconds and the chat otherwise looks frozen while the tool runs.",
              // No required parameters — the brief is reconstructed from
              // the current transcript server-side.
              parameters: { type: "object", properties: {} },
            },
          ],
          upstreamController.signal,
        );

        // An empty assistant turn is legitimate when the chat model went
        // straight to a tool call (no chat text deltas). We only treat
        // "no deltas AND no tool calls" as a true provider failure.
        let hadToolCalls = false;
        let hadDeltas = false;

        for await (const chunk of chatStream) {
          if (chunk.type === "delta") {
            const delta = fixStreamingMarkdownBoundary(
              accumulated,
              chunk.text,
            );
            accumulated += delta;
            hadDeltas = true;
            send("delta", { delta });

            if (Date.now() - lastCheckpoint >= 750) {
              await checkpointAssistant(
                userId,
                turn.assistantMessageId,
                accumulated,
              );
              lastCheckpoint = Date.now();
            }
            continue;
          }

          if (chunk.type === "tool_call" && chunk.name === "save_brief_version") {
            hadToolCalls = true;
            try {
              const brief = await recordBriefFromChat(
                userId,
                input.threadId,
              );
              if (brief) {
                send("brief_created", {
                  assistantMessageId: turn.assistantMessageId,
                  brief: {
                    id: brief.id,
                    version: brief.version,
                    prompt: brief.prompt,
                    gaps: brief.gaps,
                    createdAt: brief.createdAt,
                  },
                });
              }
            } catch (briefError) {
              // A failed brief tool call should not poison the rest of the
              // turn — the model still produced a chat reply and we want to
              // save that. Log and continue.
              console.error(
                `[chat] save_brief_version tool failed for thread ${input.threadId}`,
                briefError,
              );
            }
          }
        }

        const finalContent = fixInlineMarkdown(accumulated);
        if (!hadDeltas && !hadToolCalls) {
          throw new Error("Provider returned an empty response");
        }
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
