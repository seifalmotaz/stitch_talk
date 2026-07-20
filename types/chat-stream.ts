export type ChatStreamEvents = {
  start: {
    userMessageId?: string;
    assistantMessageId: string;
    requestId?: string;
    replay?: boolean;
  };
  delta: { delta: string };
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
