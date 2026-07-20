import type { BriefCardData } from "@/types/chat";

export type ChatStreamEvents = {
  start: {
    userMessageId?: string;
    assistantMessageId: string;
    requestId?: string;
    replay?: boolean;
  };
  delta: { delta: string };
  /**
   * Emitted when the chat model finishes a save_brief_version tool call.
   * The client appends the brief to the matching assistant message's
   * `briefs[]` array and (optionally) opens the right-side drawer.
   */
  brief_created: {
    assistantMessageId: string;
    brief: BriefCardData;
  };
  done: {
    assistantMessageId: string;
    status: "complete";
  };
  error: {
    message: string;
    retryable: boolean;
  };
};

export type ChatStreamEventName = keyof ChatStreamEvents;
