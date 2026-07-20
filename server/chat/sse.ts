import type {
  ChatStreamEventName,
  ChatStreamEvents,
} from "@/types/chat-stream";

export function encodeSseEvent<TEvent extends ChatStreamEventName>(
  event: TEvent,
  data: ChatStreamEvents[TEvent],
) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}
